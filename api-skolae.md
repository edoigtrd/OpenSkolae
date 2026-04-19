# Documentation API Skolae (Kordis GES)

Reverse-engineering des appels API de l'application Android Skolae (décompilée via jadx).

---

## Sommaire

1. [Headers HTTP exacts — éviter les 403](#headers-http-exacts--éviter-les-403)
2. [Configuration générale](#configuration-générale)
3. [Authentification](#authentification)
4. [Profil utilisateur](#profil-utilisateur)
5. [Agenda](#agenda)
6. [Notes](#notes)
7. [Absences](#absences)
8. [Matières (Disciplines)](#matières-disciplines)
9. [Actualités](#actualités)
10. [Projets pédagogiques](#projets-pédagogiques)
11. [Vie scolaire](#vie-scolaire)
12. [Notifications](#notifications)
13. [Speed Meetings](#speed-meetings)
14. [Modèles de données](#modèles-de-données)
15. [Gestion des erreurs](#gestion-des-erreurs)

---

## Headers HTTP exacts — éviter les 403

> **Cause principale des erreurs 403** : le serveur Kordis filtre les requêtes en fonction du `User-Agent`. L'application utilise OkHttp 3.13.1 et le serveur attend exactement son user-agent. Python (`requests`) envoie par défaut `python-requests/x.x.x` et des headers supplémentaires (`Accept: */*`) que OkHttp n'envoie **pas**, ce qui peut déclencher un 403.

### Ce qu'envoie exactement OkHttp 3.13.1 (source : `BridgeInterceptor.java` + `Version.java`)

OkHttp reconstruit les headers de chaque requête via son `BridgeInterceptor` :

```
User-Agent: okhttp/3.13.1
Host: <hôte extrait de l'URL>
Connection: Keep-Alive
Accept-Encoding: gzip
```

**Ce que OkHttp N'envoie PAS** (contrairement à `requests`) :
- ❌ `Accept: */*` — absent de toutes les requêtes OkHttp
- ❌ `Accept-Encoding: deflate` — OkHttp envoie `gzip` seulement
- ❌ `Accept-Language` — non envoyé

De plus, l'intercepteur de service (`getSafeOkHttpServiceClient`) **supprime activement** les headers `Accept` et `Content-Type` pour les remplacer par des valeurs custom :

```java
// HttpUtils.java - lambda$getSafeOkHttpServiceClient$3
builderNewBuilder.removeHeader("Accept");
builderNewBuilder.removeHeader("Content-Type");
```

### Session Python corrigée

```python
import requests

# Session calquée sur le comportement exact de OkHttp 3.13.1
session = requests.Session()

# Supprimer les headers par défaut de requests
session.headers.clear()

# Appliquer exactement les headers OkHttp
OKHTTP_HEADERS = {
    "User-Agent": "okhttp/3.13.1",
    "Connection": "Keep-Alive",
    "Accept-Encoding": "gzip",
    # Pas d'Accept, pas d'Accept-Language, pas de Content-Type (sauf si body)
}
session.headers.update(OKHTTP_HEADERS)
```

### Récapitulatif des headers par type de requête

| Header | GET sans body | POST JSON | POST form-urlencoded |
|---|---|---|---|
| `User-Agent` | `okhttp/3.13.1` | `okhttp/3.13.1` | `okhttp/3.13.1` |
| `Host` | auto | auto | auto |
| `Connection` | `Keep-Alive` | `Keep-Alive` | `Keep-Alive` |
| `Accept-Encoding` | `gzip` | `gzip` | `gzip` |
| `Content-Type` | — | `application/json; charset=UTF-8` | `application/x-www-form-urlencoded` |
| `Content-Length` | — | longueur exacte | longueur exacte |
| `Accept` | **absent** | **absent** | **absent** |
| `Authorization` | `Bearer <token>` | `Bearer <token>` | — |

### Flux OAuth : ne pas suivre les redirects

La requête de login retourne un **HTTP 302** dont le header `Location` contient le token dans son fragment `#`. OkHttp ne suit **pas** ce redirect (la cible utilise un schéma custom non-HTTP). Avec Python, il faut explicitement désactiver le suivi des redirects :

```python
# CORRECT - allow_redirects=False obligatoire
response = session.get(url, allow_redirects=False)
location = response.headers["Location"]  # contient #access_token=...

# INCORRECT - requests suivrait le redirect et échouerait avec une erreur de connexion
response = session.get(url)  # NE PAS FAIRE
```

---

## Configuration générale

### URLs de base

| Environnement | Service | URL |
|---|---|---|
| Production | API principale | `https://api.kordis.fr/` |
| Production | Authentification | `https://authentication.kordis.fr/` |
| Préprod | Authentification | `https://preprod.authentication.kordis.fr/` |

### En-têtes communs

Tous les appels authentifiés nécessitent :

```
Authorization: Bearer <access_token>
```

### Enveloppe de réponse commune

Toutes les réponses de l'API `api.kordis.fr` sont enveloppées dans :

```json
{
  "responseCode": 200,
  "version": "1.0",
  "exception": null,
  "result": { ... }
}
```

| Champ | Type | Description |
|---|---|---|
| `responseCode` | int | Code HTTP de la réponse métier |
| `version` | string | Version de l'API |
| `exception` | string\|null | Message d'erreur si applicable |
| `result` | T | Données de la réponse |

---

## Authentification

### Flux OAuth 2.0 (login password)

L'authentification utilise un flux OAuth 2.0 implicite avec redirection. Le token est extrait du fragment `#` de l'URL de redirection.

**Requête :**

```
GET https://authentication.kordis.fr/oauth/authorize?response_type=token&client_id=skolae-app
Authorization: Basic <base64(username:password)>
```

Le serveur répond avec un redirect HTTP 302. Le token est dans le fragment de l'URL :

```
Location: ...#access_token=<TOKEN>&token_type=Bearer&expires_in=3600
```

```python
import requests
import base64

# Headers identiques à OkHttp 3.13.1 (version embarquée dans l'APK)
# OBLIGATOIRE : le serveur filtre sur User-Agent et refuse les clients non-mobile
OKHTTP_HEADERS = {
    "User-Agent": "okhttp/3.13.1",
    "Connection": "Keep-Alive",
    "Accept-Encoding": "gzip",
    # Pas d'Accept, pas d'Accept-Language — OkHttp ne les envoie pas
}

def login(username: str, password: str) -> dict:
    """
    Authentification via OAuth 2.0 implicite.
    Retourne un dict avec access_token, token_type, expires_in.

    Reproduit exactement le comportement de OkHttp 3.13.1 :
    - User-Agent: okhttp/3.13.1
    - Pas de header Accept
    - allow_redirects=False : le token est dans le fragment # du header Location du 302
    """
    credentials = base64.b64encode(f"{username}:{password}".encode()).decode()

    headers = {
        **OKHTTP_HEADERS,
        "Authorization": f"Basic {credentials}",
        # OkHttp remplace TOUS les headers avec .headers() donc Accept-Encoding reste
    }

    # IMPORTANT : allow_redirects=False obligatoire
    # OkHttp ne suit pas ce redirect (schéma custom non-HTTP côté serveur)
    # Python suivrait le redirect par défaut et échouerait
    response = requests.get(
        "https://authentication.kordis.fr/oauth/authorize",
        params={"response_type": "token", "client_id": "skolae-app"},
        headers=headers,
        allow_redirects=False,
    )

    location = response.headers.get("Location", "")
    if "access_token" not in location:
        raise ValueError(f"Identifiants invalides (HTTP {response.status_code})")

    # Token dans le fragment : https://.../#access_token=xxx&token_type=Bearer&expires_in=3600
    fragment = location.split("#")[1]
    token_data = dict(pair.split("=") for pair in fragment.split("&"))
    return token_data

# Utilisation
token_data = login("mon_username", "mon_password")
access_token = token_data["access_token"]
token_type = token_data.get("token_type", "Bearer")
auth_header = f"{token_type} {access_token}"
```

---

### Changement de mot de passe

```
POST https://authentication.kordis.fr/change-password
Content-Type: application/x-www-form-urlencoded
```

| Champ | Type | Description |
|---|---|---|
| `username` | string | Nom d'utilisateur |
| `current_password` | string | Mot de passe actuel |
| `new_password` | string | Nouveau mot de passe |
| `confirm_password` | string | Confirmation du nouveau mot de passe |
| `is_recovery_code` | boolean | Indique si on utilise un code de récupération |

```python
import requests

def change_password(username: str, current_password: str, new_password: str) -> bool:
    url = "https://authentication.kordis.fr/change-password"
    data = {
        "username": username,
        "current_password": current_password,
        "new_password": new_password,
        "confirm_password": new_password,
        "is_recovery_code": False
    }
    response = requests.post(url, data=data)
    return response.ok
```

---

### Récupération de mot de passe

```
POST https://authentication.kordis.fr/recover-password
Content-Type: application/x-www-form-urlencoded
```

| Champ | Type | Description |
|---|---|---|
| `email` | string | Adresse email du compte |

```python
def recover_password(email: str) -> bool:
    url = "https://authentication.kordis.fr/recover-password"
    response = requests.post(url, data={"email": email})
    return response.ok
```

---

## Profil utilisateur

Base URL : `https://api.kordis.fr/`

### GET /me — Compte authentifié

Récupère les informations du compte connecté.

```
GET https://api.kordis.fr/me
Authorization: Bearer <token>
```

**Réponse `result` :**

```json
{
  "uid": 12345,
  "username": "prenom.nom",
  "client_id": "skolae-app",
  "role": "STUDENT",
  "normalized_role": "student",
  "scopes": ["read", "write"],
  "resources": []
}
```

```python
import requests

BASE_URL = "https://api.kordis.fr"

def get_account(token: str) -> dict:
    response = requests.get(
        f"{BASE_URL}/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    response.raise_for_status()
    return response.json()["result"]
```

---

### GET /me/profile — Profil détaillé

```
GET https://api.kordis.fr/me/profile
Authorization: Bearer <token>
```

**Réponse `result` :**

```json
{
  "uid": 12345,
  "username": "prenom.nom",
  "student_id": "ETU202401",
  "civility": "M.",
  "firstname": "Prénom",
  "name": "NOM",
  "maiden_name": null,
  "birthday": 946684800000,
  "nationality": "Française",
  "birthplace": "Paris",
  "birth_country": "France",
  "address1": "1 rue de la Paix",
  "address2": null,
  "city": "Paris",
  "zipcode": "75001",
  "country": "France",
  "telephone": "0600000000",
  "mobile": "0600000000",
  "email": "prenom.nom@ecole.fr",
  "ine": "1234567890A",
  "emergency_contact": {
    "name": "Contact Urgence",
    "phone": "0600000001"
  },
  "connected": true
}
```

```python
def get_profile(token: str) -> dict:
    response = requests.get(
        f"{BASE_URL}/me/profile",
        headers={"Authorization": f"Bearer {token}"}
    )
    response.raise_for_status()
    return response.json()["result"]
```

---

### PUT /me/profile — Mettre à jour le profil

```
PUT https://api.kordis.fr/me/profile
Authorization: Bearer <token>
Content-Type: application/json
```

Body : objet `Profile` (cf. modèle ci-dessus)

```python
def update_profile(token: str, profile_data: dict) -> dict:
    response = requests.put(
        f"{BASE_URL}/me/profile",
        headers={"Authorization": f"Bearer {token}"},
        json=profile_data
    )
    response.raise_for_status()
    return response.json()["result"]
```

---

### POST /me/profile — Photo de profil (multipart)

```
POST https://api.kordis.fr/me/profile
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

```python
def upload_profile_picture(token: str, image_path: str) -> dict:
    with open(image_path, "rb") as f:
        response = requests.post(
            f"{BASE_URL}/me/profile",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": f}
        )
    response.raise_for_status()
    return response.json()["result"]
```

---

### GET /me/years — Années scolaires disponibles

```
GET https://api.kordis.fr/me/years
Authorization: Bearer <token>
```

**Réponse `result` :** `[2022, 2023, 2024]`

```python
def get_years(token: str) -> list:
    response = requests.get(
        f"{BASE_URL}/me/years",
        headers={"Authorization": f"Bearer {token}"}
    )
    response.raise_for_status()
    return response.json()["result"]
```

---

### GET /me/trimesterYears — Années avec semestres

```
GET https://api.kordis.fr/me/trimesterYears
Authorization: Bearer <token>
```

```python
def get_trimester_years(token: str) -> list:
    response = requests.get(
        f"{BASE_URL}/me/trimesterYears",
        headers={"Authorization": f"Bearer {token}"}
    )
    response.raise_for_status()
    return response.json()["result"]
```

---

### GET /me/{year}/classes — Promotions de l'année

```
GET https://api.kordis.fr/me/{year}/classes
Authorization: Bearer <token>
```

| Paramètre | Type | Emplacement | Description |
|---|---|---|---|
| `year` | int | path | Année scolaire (ex: 2024) |

```python
def get_promotions(token: str, year: int) -> list:
    response = requests.get(
        f"{BASE_URL}/me/{year}/classes",
        headers={"Authorization": f"Bearer {token}"}
    )
    response.raise_for_status()
    return response.json()["result"]
```

---

### GET /me/{year}/students — Liste des étudiants (simple)

```
GET https://api.kordis.fr/me/{year}/students
Authorization: Bearer <token>
```

```python
def get_students(token: str, year: int) -> list:
    response = requests.get(
        f"{BASE_URL}/me/{year}/students",
        headers={"Authorization": f"Bearer {token}"}
    )
    response.raise_for_status()
    return response.json()["result"]
```

---

### GET /me/classes/{puid}/students/{year} — Étudiants d'une promotion

```
GET https://api.kordis.fr/me/classes/{puid}/students/{year}
Authorization: Bearer <token>
```

| Paramètre | Type | Emplacement | Description |
|---|---|---|---|
| `puid` | int | path | ID de la promotion (class uid) |
| `year` | int | path | Année scolaire |

```python
def get_students_by_class(token: str, puid: int, year: int) -> list:
    response = requests.get(
        f"{BASE_URL}/me/classes/{puid}/students/{year}",
        headers={"Authorization": f"Bearer {token}"}
    )
    response.raise_for_status()
    return response.json()["result"]
```

---

### GET /me/{year}/teachers — Enseignants de l'année

```
GET https://api.kordis.fr/me/{year}/teachers
Authorization: Bearer <token>
```

```python
def get_teachers(token: str, year: int) -> list:
    response = requests.get(
        f"{BASE_URL}/me/{year}/teachers",
        headers={"Authorization": f"Bearer {token}"}
    )
    response.raise_for_status()
    return response.json()["result"]
```

---

### GET /me/minimumVersion — Version minimale de l'app

```
GET https://api.kordis.fr/me/minimumVersion
Authorization: Bearer <token>
```

```python
def get_minimum_version(token: str) -> dict:
    response = requests.get(
        f"{BASE_URL}/me/minimumVersion",
        headers={"Authorization": f"Bearer {token}"}
    )
    response.raise_for_status()
    return response.json()["result"]
```

---

### GET /documents/internalrules — Règlement intérieur

```
GET https://api.kordis.fr/documents/internalrules
Authorization: Bearer <token>
```

Retourne un fichier (PDF ou HTML).

```python
def get_internal_rules(token: str) -> bytes:
    response = requests.get(
        f"{BASE_URL}/documents/internalrules",
        headers={"Authorization": f"Bearer {token}"}
    )
    response.raise_for_status()
    return response.content
```

---

### PATCH /me/internalrules — Valider le règlement intérieur

```
PATCH https://api.kordis.fr/me/internalrules
Authorization: Bearer <token>
```

```python
def validate_internal_rules(token: str) -> bool:
    response = requests.patch(
        f"{BASE_URL}/me/internalrules",
        headers={"Authorization": f"Bearer {token}"}
    )
    return response.ok
```

---

### PATCH /me/cvec — Enregistrer le statut CVEC

```
PATCH https://api.kordis.fr/me/cvec
Authorization: Bearer <token>
Content-Type: application/json
```

```python
def save_cvec(token: str, cvec_data: dict) -> bool:
    response = requests.patch(
        f"{BASE_URL}/me/cvec",
        headers={"Authorization": f"Bearer {token}"},
        json=cvec_data
    )
    return response.ok
```

---

## Agenda

### GET /me/agenda — Entrées d'agenda

```
GET https://api.kordis.fr/me/agenda?start=<timestamp>&end=<timestamp>
Authorization: Bearer <token>
```

| Paramètre | Type | Emplacement | Description |
|---|---|---|---|
| `start` | long | query | Timestamp Unix en millisecondes (début de période) |
| `end` | long | query | Timestamp Unix en millisecondes (fin de période) |

**Réponse `result` :** liste d'`AgendaEntry`

```json
[
  {
    "reservation_id": 98765,
    "name": "Cours de Mathématiques",
    "type": "Cours",
    "start_date": 1700000000000,
    "end_date": 1700007200000,
    "username": "prenom.nom",
    "lastUpdateDate": 1699990000000,
    "author": 1,
    "state": "Confirmé",
    "comment": "",
    "teacher": "M. MARTIN Jean",
    "promotion": "B3 Informatique",
    "modality": "Présentiel",
    "discipline": { ... },
    "rooms": [
      { "name": "Salle 101", "building": "Bâtiment A" }
    ]
  }
]
```

```python
import time
from datetime import datetime, timedelta

def get_agenda(token: str, start: datetime, end: datetime) -> list:
    """
    Récupère les entrées d'agenda entre deux dates.
    Les timestamps sont en millisecondes.
    """
    start_ms = int(start.timestamp() * 1000)
    end_ms = int(end.timestamp() * 1000)
    
    response = requests.get(
        f"{BASE_URL}/me/agenda",
        headers={"Authorization": f"Bearer {token}"},
        params={"start": start_ms, "end": end_ms}
    )
    response.raise_for_status()
    return response.json()["result"]

# Exemple : agenda de la semaine courante
now = datetime.now()
start_of_week = now - timedelta(days=now.weekday())
end_of_week = start_of_week + timedelta(days=7)
entries = get_agenda(token, start_of_week, end_of_week)
```

---

## Notes

### GET /me/{year}/grades — Notes de l'année

```
GET https://api.kordis.fr/me/{year}/grades
Authorization: Bearer <token>
```

| Paramètre | Type | Emplacement | Description |
|---|---|---|---|
| `year` | int | path | Année scolaire |

**Réponse `result` :** liste de `Grade`

```json
[
  {
    "id": "grade_abc123",
    "username": "prenom.nom",
    "subject": "Mathématiques",
    "course": "Algèbre linéaire",
    "exam": 14.5,
    "average": 13.2,
    "ects": "3",
    "coef": "2",
    "year": 2024,
    "teacher_civility": "M.",
    "teacher_first_name": "Jean",
    "teacher_last_name": "MARTIN",
    "trimester": 1,
    "rc_id": 5678,
    "lastUpdateDate": 1700000000000,
    "grades": [14.5, 12.0, 13.0]
  }
]
```

```python
def get_grades(token: str, year: int) -> list:
    response = requests.get(
        f"{BASE_URL}/me/{year}/grades",
        headers={"Authorization": f"Bearer {token}"}
    )
    response.raise_for_status()
    return response.json()["result"]
```

---

## Absences

### GET /me/{year}/absences — Absences de l'année

```
GET https://api.kordis.fr/me/{year}/absences
Authorization: Bearer <token>
```

| Paramètre | Type | Emplacement | Description |
|---|---|---|---|
| `year` | int | path | Année scolaire |

**Réponse `result` :** liste d'`Absence`

```json
[
  {
    "id": "abs_xyz789",
    "course_name": "Mathématiques",
    "username": "prenom.nom",
    "justified": false,
    "trimester": 1,
    "year": 2024,
    "date": 1700000000000
  }
]
```

```python
def get_absences(token: str, year: int) -> list:
    response = requests.get(
        f"{BASE_URL}/me/{year}/absences",
        headers={"Authorization": f"Bearer {token}"}
    )
    response.raise_for_status()
    return response.json()["result"]
```

---

## Matières (Disciplines)

### GET /me/{year}/courses — Matières de l'année

```
GET https://api.kordis.fr/me/{year}/courses
Authorization: Bearer <token>
```

**Réponse `result` :** liste de `Discipline`

```json
[
  {
    "id": "disc_001",
    "username": "prenom.nom",
    "rc_id": 5678,
    "name": "Mathématiques",
    "nb_students": 25,
    "school_id": 1,
    "student_group_id": 10,
    "student_group_name": "B3 Info",
    "teacher": "MARTIN Jean",
    "teacher_id": 99,
    "trimester": 1,
    "trimester_id": 1,
    "year": 2024
  }
]
```

```python
def get_disciplines(token: str, year: int) -> list:
    response = requests.get(
        f"{BASE_URL}/me/{year}/courses",
        headers={"Authorization": f"Bearer {token}"}
    )
    response.raise_for_status()
    return response.json()["result"]
```

---

### GET /me/{rcId}/files — Fichiers d'une matière

```
GET https://api.kordis.fr/me/{rcId}/files
Authorization: Bearer <token>
```

| Paramètre | Type | Emplacement | Description |
|---|---|---|---|
| `rcId` | int | path | ID de la matière (`rc_id`) |

```python
def get_discipline_files(token: str, rc_id: int) -> list:
    response = requests.get(
        f"{BASE_URL}/me/{rc_id}/files",
        headers={"Authorization": f"Bearer {token}"}
    )
    response.raise_for_status()
    return response.json()["result"]
```

---

### GET /me/{rcId}/files/{ocId} — Télécharger un fichier

```
GET https://api.kordis.fr/me/{rcId}/files/{ocId}
Authorization: Bearer <token>
```

Retourne le contenu binaire du fichier (streaming).

```python
def download_file(token: str, rc_id: int, oc_id: int, output_path: str):
    with requests.get(
        f"{BASE_URL}/me/{rc_id}/files/{oc_id}",
        headers={"Authorization": f"Bearer {token}"},
        stream=True
    ) as response:
        response.raise_for_status()
        with open(output_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
```

---

### GET /me/{rcId}/syllabus — Syllabus d'une matière

```
GET https://api.kordis.fr/me/{rcId}/syllabus
Authorization: Bearer <token>
```

```python
def get_syllabus(token: str, rc_id: int) -> list:
    response = requests.get(
        f"{BASE_URL}/me/{rc_id}/syllabus",
        headers={"Authorization": f"Bearer {token}"}
    )
    response.raise_for_status()
    return response.json()["result"]
```

---

## Actualités

### GET /me/news — Actualités (paginées)

```
GET https://api.kordis.fr/me/news?page=<page>
Authorization: Bearer <token>
```

| Paramètre | Type | Emplacement | Description |
|---|---|---|---|
| `page` | int | query | Numéro de page (commence à 0) |

**Réponse `result` :** `DataPage<News>`

```json
{
  "content": [
    {
      "id": 1,
      "title": "Titre de l'actualité",
      "content": "Contenu HTML...",
      "created_date": 1700000000000,
      "author": "Administration",
      "image_url": "https://..."
    }
  ],
  "totalPages": 5,
  "totalElements": 42,
  "number": 0,
  "size": 10
}
```

```python
def get_news(token: str, page: int = 0) -> dict:
    response = requests.get(
        f"{BASE_URL}/me/news",
        headers={"Authorization": f"Bearer {token}"},
        params={"page": page}
    )
    response.raise_for_status()
    return response.json()["result"]

def get_all_news(token: str) -> list:
    """Récupère toutes les actualités en itérant sur les pages."""
    all_news = []
    page = 0
    while True:
        data = get_news(token, page)
        all_news.extend(data["content"])
        if page >= data["totalPages"] - 1:
            break
        page += 1
    return all_news
```

---

### GET /me/news/banners — Bannières promotionnelles

```
GET https://api.kordis.fr/me/news/banners
Authorization: Bearer <token>
```

```python
def get_news_banners(token: str) -> dict:
    response = requests.get(
        f"{BASE_URL}/me/news/banners",
        headers={"Authorization": f"Bearer {token}"}
    )
    response.raise_for_status()
    return response.json()["result"]
```

---

## Projets pédagogiques

### GET /me/{year}/projects — Projets de l'année

```
GET https://api.kordis.fr/me/{year}/projects
Authorization: Bearer <token>
```

```python
def get_projects(token: str, year: int) -> list:
    response = requests.get(
        f"{BASE_URL}/me/{year}/projects",
        headers={"Authorization": f"Bearer {token}"}
    )
    response.raise_for_status()
    return response.json()["result"]
```

---

### GET /me/courses/{rcId}/projects — Projets d'une matière

```
GET https://api.kordis.fr/me/courses/{rcId}/projects
Authorization: Bearer <token>
```

```python
def get_projects_by_course(token: str, rc_id: int) -> list:
    response = requests.get(
        f"{BASE_URL}/me/courses/{rc_id}/projects",
        headers={"Authorization": f"Bearer {token}"}
    )
    response.raise_for_status()
    return response.json()["result"]
```

---

### GET /me/{year}/practicals — Travaux pratiques de l'année

```
GET https://api.kordis.fr/me/{year}/practicals
Authorization: Bearer <token>
```

```python
def get_practicals(token: str, year: int) -> list:
    response = requests.get(
        f"{BASE_URL}/me/{year}/practicals",
        headers={"Authorization": f"Bearer {token}"}
    )
    response.raise_for_status()
    return response.json()["result"]
```

---

### GET /me/courses/{rcId}/practicals — TP d'une matière

```
GET https://api.kordis.fr/me/courses/{rcId}/practicals
Authorization: Bearer <token>
```

```python
def get_practicals_by_course(token: str, rc_id: int) -> list:
    response = requests.get(
        f"{BASE_URL}/me/courses/{rc_id}/practicals",
        headers={"Authorization": f"Bearer {token}"}
    )
    response.raise_for_status()
    return response.json()["result"]
```

---

### GET /me/projects/{projectId} — Détail d'un projet

```
GET https://api.kordis.fr/me/projects/{projectId}
Authorization: Bearer <token>
```

```python
def get_project(token: str, project_id: int) -> dict:
    response = requests.get(
        f"{BASE_URL}/me/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    response.raise_for_status()
    return response.json()["result"]
```

---

### GET /me/nextProjectSteps — Prochaines étapes de projets

```
GET https://api.kordis.fr/me/nextProjectSteps
Authorization: Bearer <token>
```

```python
def get_next_project_steps(token: str) -> list:
    response = requests.get(
        f"{BASE_URL}/me/nextProjectSteps",
        headers={"Authorization": f"Bearer {token}"}
    )
    response.raise_for_status()
    return response.json()["result"]
```

---

### POST /me/courses/{rcId}/projects/{projectId}/groups/{groupId} — Rejoindre un groupe

```
POST https://api.kordis.fr/me/courses/{rcId}/projects/{projectId}/groups/{projectGroupId}
Authorization: Bearer <token>
```

| Paramètre | Type | Emplacement | Description |
|---|---|---|---|
| `rcId` | int | path | ID de la matière |
| `projectId` | int | path | ID du projet |
| `projectGroupId` | int | path | ID du groupe |

```python
def join_project_group(token: str, rc_id: int, project_id: int, group_id: int) -> bool:
    response = requests.post(
        f"{BASE_URL}/me/courses/{rc_id}/projects/{project_id}/groups/{group_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    return response.ok
```

---

### DELETE /me/courses/{rcId}/projects/{projectId}/groups/{groupId} — Quitter un groupe

```
DELETE https://api.kordis.fr/me/courses/{rcId}/projects/{projectId}/groups/{projectGroupId}
Authorization: Bearer <token>
```

```python
def quit_project_group(token: str, rc_id: int, project_id: int, group_id: int) -> bool:
    response = requests.delete(
        f"{BASE_URL}/me/courses/{rc_id}/projects/{project_id}/groups/{group_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    return response.ok
```

---

### GET /me/projectGroups/{groupId}/messages — Messages d'un groupe

```
GET https://api.kordis.fr/me/projectGroups/{projectGroupId}/messages
Authorization: Bearer <token>
```

```python
def get_group_messages(token: str, group_id: int) -> list:
    response = requests.get(
        f"{BASE_URL}/me/projectGroups/{group_id}/messages",
        headers={"Authorization": f"Bearer {token}"}
    )
    response.raise_for_status()
    return response.json()["result"]
```

---

### POST /me/projectGroups/{groupId}/messages — Envoyer un message

```
POST https://api.kordis.fr/me/projectGroups/{projectGroupId}/messages
Authorization: Bearer <token>
Content-Type: application/json
```

**Body :**

```json
{
  "project_group_id": 42,
  "message": "Bonjour à tous !"
}
```

```python
def send_group_message(token: str, group_id: int, message: str) -> list:
    response = requests.post(
        f"{BASE_URL}/me/projectGroups/{group_id}/messages",
        headers={"Authorization": f"Bearer {token}"},
        json={"project_group_id": group_id, "message": message}
    )
    response.raise_for_status()
    return response.json()["result"]
```

---

### DELETE /me/projectGroups/{groupId}/messages/{messageId} — Supprimer un message

```
DELETE https://api.kordis.fr/me/projectGroups/{projectGroupId}/messages/{projectMessageId}
Authorization: Bearer <token>
```

```python
def delete_group_message(token: str, group_id: int, message_id: int) -> list:
    response = requests.delete(
        f"{BASE_URL}/me/projectGroups/{group_id}/messages/{message_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    response.raise_for_status()
    return response.json()["result"]
```

---

### Téléchargement de fichiers projet

```
GET https://api.kordis.fr/me/projectFiles/{pfId}
GET https://api.kordis.fr/me/projectStepFiles/{psfId}
Authorization: Bearer <token>
```

```python
def download_project_file(token: str, pf_id: int, output_path: str):
    with requests.get(
        f"{BASE_URL}/me/projectFiles/{pf_id}",
        headers={"Authorization": f"Bearer {token}"},
        stream=True
    ) as response:
        response.raise_for_status()
        with open(output_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

def download_project_step_file(token: str, psf_id: int, output_path: str):
    with requests.get(
        f"{BASE_URL}/me/projectStepFiles/{psf_id}",
        headers={"Authorization": f"Bearer {token}"},
        stream=True
    ) as response:
        response.raise_for_status()
        with open(output_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
```

---

## Vie scolaire

### GET /me/{year}/annualDocuments — Documents annuels

```
GET https://api.kordis.fr/me/{year}/annualDocuments
Authorization: Bearer <token>
```

```python
def get_annual_documents(token: str, year: int) -> list:
    response = requests.get(
        f"{BASE_URL}/me/{year}/annualDocuments",
        headers={"Authorization": f"Bearer {token}"}
    )
    response.raise_for_status()
    return response.json()["result"]
```

---

### GET /me/annualDocuments/{id} — Télécharger un document annuel

```
GET https://api.kordis.fr/me/annualDocuments/{id}
Authorization: Bearer <token>
```

```python
def download_annual_document(token: str, doc_id: int, output_path: str):
    with requests.get(
        f"{BASE_URL}/me/annualDocuments/{doc_id}",
        headers={"Authorization": f"Bearer {token}"},
        stream=True
    ) as response:
        response.raise_for_status()
        with open(output_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
```

---

### GET /me/partners — Partenaires

```
GET https://api.kordis.fr/me/partners
Authorization: Bearer <token>
```

```python
def get_partners(token: str) -> list:
    response = requests.get(
        f"{BASE_URL}/me/partners",
        headers={"Authorization": f"Bearer {token}"}
    )
    response.raise_for_status()
    return response.json()["result"]
```

---

### POST /me/suggestion — Soumettre une suggestion

```
POST https://api.kordis.fr/me/suggestion
Authorization: Bearer <token>
Content-Type: application/json
```

**Body :**

```json
{
  "application_id": "skolae-app",
  "content": "Ma suggestion..."
}
```

**Réponse `result` :**

```json
{
  "suggestion_id": 99,
  "application_id": "skolae-app",
  "content": "Ma suggestion...",
  "create_date": 1700000000000,
  "u_id": 12345
}
```

```python
def submit_suggestion(token: str, content: str) -> dict:
    response = requests.post(
        f"{BASE_URL}/me/suggestion",
        headers={"Authorization": f"Bearer {token}"},
        json={"application_id": "skolae-app", "content": content}
    )
    response.raise_for_status()
    return response.json()["result"]
```

---

## Notifications

### GET /me/notificationsDelays — Rappels de notification

```
GET https://api.kordis.fr/me/notificationsDelays
Authorization: Bearer <token>
```

**Réponse `result` :** liste de `NotificationRemind`

```json
[
  {
    "uid": 12345,
    "notification_type_id": 1,
    "notification_type_name": "Cours",
    "delay_in_seconds": 900,
    "upd_date": 1700000000000
  }
]
```

```python
def get_notification_delays(token: str) -> list:
    response = requests.get(
        f"{BASE_URL}/me/notificationsDelays",
        headers={"Authorization": f"Bearer {token}"}
    )
    response.raise_for_status()
    return response.json()["result"]
```

---

### POST /me/notificationsDelays — Créer/Modifier un rappel

```
POST https://api.kordis.fr/me/notificationsDelays
Authorization: Bearer <token>
Content-Type: application/json
```

**Body :**

```json
{
  "uid": 12345,
  "notification_type_id": 1,
  "notification_type_name": "Cours",
  "delay_in_seconds": 900
}
```

```python
def upsert_notification_delay(token: str, notification_type_id: int, delay_seconds: int) -> dict:
    response = requests.post(
        f"{BASE_URL}/me/notificationsDelays",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "notification_type_id": notification_type_id,
            "delay_in_seconds": delay_seconds
        }
    )
    response.raise_for_status()
    return response.json()["result"]
```

---

### DELETE /me/notificationsDelays/{notificationTypeId} — Supprimer un rappel

```
DELETE https://api.kordis.fr/me/notificationsDelays/{notificationTypeId}
Authorization: Bearer <token>
```

```python
def delete_notification_delay(token: str, notification_type_id: int) -> bool:
    response = requests.delete(
        f"{BASE_URL}/me/notificationsDelays/{notification_type_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    return response.ok
```

---

## Speed Meetings

### GET /me/speedMeetingAppointments — Rendez-vous speed meeting

Cet endpoint accepte des query params optionnels pour filtrer par date.

```
GET https://api.kordis.fr/me/speedMeetingAppointments
GET https://api.kordis.fr/me/speedMeetingAppointments?start=<timestamp_ms>
GET https://api.kordis.fr/me/speedMeetingAppointments?end=<timestamp_ms>
GET https://api.kordis.fr/me/speedMeetingAppointments?start=<timestamp_ms>&end=<timestamp_ms>
Authorization: Bearer <token>
```

| Paramètre | Type | Obligatoire | Description |
|---|---|---|---|
| `start` | long | Non | Timestamp ms — filtre les RDV après cette date |
| `end` | long | Non | Timestamp ms — filtre les RDV avant cette date |

```python
from datetime import datetime

def get_speed_meetings(token: str, start: datetime = None, end: datetime = None) -> list:
    params = {}
    if start:
        params["start"] = int(start.timestamp() * 1000)
    if end:
        params["end"] = int(end.timestamp() * 1000)
    
    response = requests.get(
        f"{BASE_URL}/me/speedMeetingAppointments",
        headers={"Authorization": f"Bearer {token}"},
        params=params
    )
    response.raise_for_status()
    return response.json()["result"]
```

---

## Modèles de données

### GesApiResponse\<T\>

```json
{
  "responseCode": 200,
  "version": "1.0",
  "exception": null,
  "result": "<T>"
}
```

### AuthenticatedUser

```json
{
  "uid": 12345,
  "username": "prenom.nom",
  "client_id": "skolae-app",
  "role": "STUDENT",
  "normalized_role": "student",
  "scopes": ["read"],
  "resources": []
}
```

### Profile

```json
{
  "uid": 12345,
  "username": "prenom.nom",
  "student_id": "ETU202401",
  "civility": "M.",
  "firstname": "Prénom",
  "name": "NOM",
  "maiden_name": null,
  "birthday": 946684800000,
  "nationality": "Française",
  "birthplace": "Paris",
  "birth_country": "France",
  "address1": "1 rue de la Paix",
  "address2": null,
  "city": "Paris",
  "zipcode": "75001",
  "country": "France",
  "telephone": "0600000000",
  "mobile": "0600000001",
  "email": "prenom.nom@ecole.fr",
  "ine": "1234567890A",
  "emergency_contact": {
    "name": "Contact Urgence",
    "phone": "0600000002"
  },
  "connected": true
}
```

### AgendaEntry

```json
{
  "reservation_id": 98765,
  "name": "Cours de Mathématiques",
  "type": "Cours",
  "start_date": 1700000000000,
  "end_date": 1700007200000,
  "username": "prenom.nom",
  "lastUpdateDate": 1699990000000,
  "author": 1,
  "state": "Confirmé",
  "comment": "",
  "teacher": "M. MARTIN Jean",
  "promotion": "B3 Informatique",
  "modality": "Présentiel",
  "discipline": {
    "id": "disc_001",
    "rc_id": 5678,
    "name": "Mathématiques"
  },
  "rooms": [
    { "name": "Salle 101" }
  ]
}
```

### Grade

```json
{
  "id": "grade_abc123",
  "username": "prenom.nom",
  "subject": "Mathématiques",
  "course": "Algèbre linéaire",
  "exam": 14.5,
  "average": 13.2,
  "ects": "3",
  "coef": "2",
  "year": 2024,
  "teacher_civility": "M.",
  "teacher_first_name": "Jean",
  "teacher_last_name": "MARTIN",
  "trimester": 1,
  "rc_id": 5678,
  "lastUpdateDate": 1700000000000,
  "grades": [14.5, 12.0, 13.0]
}
```

### Absence

```json
{
  "id": "abs_xyz789",
  "course_name": "Mathématiques",
  "username": "prenom.nom",
  "justified": false,
  "trimester": 1,
  "year": 2024,
  "date": 1700000000000
}
```

### NotificationRemind

```json
{
  "uid": 12345,
  "notification_type_id": 1,
  "notification_type_name": "Cours",
  "delay_in_seconds": 900,
  "upd_date": 1700000000000
}
```

### ProjectMessageCommandDTO

```json
{
  "project_group_id": 42,
  "message": "Texte du message"
}
```

### SuggestionCommandDTO

```json
{
  "application_id": "skolae-app",
  "content": "Texte de la suggestion"
}
```

---

## Gestion des erreurs

| Code HTTP | Signification | Comportement de l'app |
|---|---|---|
| `200–299` | Succès | Traitement normal |
| `401` | Token expiré / invalide | Affichage dialogue de reconnexion |
| `423` | Application verrouillée | Affichage dialogue de verrouillage avec `LockAction` |

### Format d'erreur 423

```json
{
  "responseCode": 423,
  "version": "1.0",
  "exception": "Application locked",
  "result": {
    "type": "FORCE_UPDATE"
  }
}
```

Types de `LockAction` : `NONE`, `FORCE_UPDATE`, et autres valeurs possibles du backend.

### Client Python complet avec headers corrects

```python
import base64
import requests


# Headers identiques à OkHttp 3.13.1 (version dans l'APK - okhttp3/internal/Version.java)
# Le serveur Kordis filtre sur le User-Agent : sans ce header exact → HTTP 403
_OKHTTP_HEADERS = {
    "User-Agent": "okhttp/3.13.1",
    "Connection": "Keep-Alive",
    "Accept-Encoding": "gzip",
    # Pas de Accept, Accept-Language : OkHttp BridgeInterceptor ne les ajoute pas
}


class SkolaeClient:
    AUTH_URL = "https://authentication.kordis.fr/oauth/authorize"
    BASE_URL = "https://api.kordis.fr"

    def __init__(self, username: str, password: str):
        self._session = requests.Session()
        # Remplacer tous les headers par défaut de requests par les headers OkHttp
        self._session.headers.clear()
        self._session.headers.update(_OKHTTP_HEADERS)
        self._auth_header = self._login(username, password)

    def _login(self, username: str, password: str) -> str:
        credentials = base64.b64encode(f"{username}:{password}".encode()).decode()

        # allow_redirects=False OBLIGATOIRE :
        # Le serveur renvoie 302 avec le token dans le fragment # du header Location.
        # OkHttp ne suit pas ce redirect (schéma custom non-HTTP).
        # requests le suivrait par défaut et échouerait.
        response = self._session.get(
            self.AUTH_URL,
            params={"response_type": "token", "client_id": "skolae-app"},
            headers={"Authorization": f"Basic {credentials}"},
            allow_redirects=False,
        )

        location = response.headers.get("Location", "")
        if "access_token" not in location:
            raise ValueError(
                f"Identifiants invalides ou accès refusé (HTTP {response.status_code})"
            )

        fragment = location.split("#")[1]
        token_data = dict(p.split("=") for p in fragment.split("&"))
        token_type = token_data.get("token_type", "Bearer")
        return f"{token_type} {token_data['access_token']}"

    def _get(self, path: str, **kwargs) -> dict:
        response = self._session.get(
            f"{self.BASE_URL}{path}",
            headers={"Authorization": self._auth_header},
            **kwargs,
        )
        if response.status_code == 401:
            raise PermissionError("Token expiré — reconnexion nécessaire")
        if response.status_code == 423:
            lock = response.json().get("result", {})
            raise RuntimeError(f"Application verrouillée : {lock.get('type')}")
        response.raise_for_status()
        return response.json()["result"]

    def _post(self, path: str, json: dict = None, **kwargs) -> dict:
        response = self._session.post(
            f"{self.BASE_URL}{path}",
            headers={"Authorization": self._auth_header},
            json=json,
            **kwargs,
        )
        response.raise_for_status()
        return response.json()["result"]

    # --- API methods ---

    def get_account(self) -> dict:
        return self._get("/me")

    def get_profile(self) -> dict:
        return self._get("/me/profile")

    def get_years(self) -> list:
        return self._get("/me/years")

    def get_grades(self, year: int) -> list:
        return self._get(f"/me/{year}/grades")

    def get_absences(self, year: int) -> list:
        return self._get(f"/me/{year}/absences")

    def get_disciplines(self, year: int) -> list:
        return self._get(f"/me/{year}/courses")

    def get_agenda(self, start_ms: int, end_ms: int) -> list:
        return self._get("/me/agenda", params={"start": start_ms, "end": end_ms})

    def get_news(self, page: int = 0) -> dict:
        return self._get("/me/news", params={"page": page})


# --- Utilisation ---
if __name__ == "__main__":
    from datetime import datetime, timedelta

    client = SkolaeClient("prenom.nom", "motdepasse")

    # Profil
    profile = client.get_profile()
    print(f"Connecté en tant que : {profile['firstname']} {profile['name']}")

    # Notes de l'année courante
    years = client.get_years()
    if years:
        grades = client.get_grades(years[-1])
        for g in grades:
            print(f"  {g['subject']} — moy: {g['average']}")

    # Agenda de la semaine
    now = datetime.now()
    start = now - timedelta(days=now.weekday())
    end = start + timedelta(days=7)
    entries = client.get_agenda(
        int(start.timestamp() * 1000),
        int(end.timestamp() * 1000),
    )
    for e in entries:
        print(f"  {e['name']} — {e['teacher']}")
```

---

## Notes importantes

- Les **timestamps** sont tous en **millisecondes Unix** (pas en secondes).
- Les **années scolaires** sont des entiers représentant l'année de début (ex: `2024` pour 2024-2025).
- L'`rc_id` (Resource Course ID) est l'identifiant clé pour accéder aux ressources liées à une matière (fichiers, syllabus, projets).
- Les endpoints avec `/me/` agissent toujours sur le compte de l'utilisateur authentifié.
- Les endpoints de téléchargement de fichiers utilisent le **streaming** — utiliser `stream=True` avec `requests`.
