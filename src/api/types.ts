export interface AuthenticatedUser {
  uid: number;
  username: string;
  client_id: string;
  role: string;
  normalized_role: string;
  scopes: string[];
  resources: any[];
}

export interface EmergencyContact {
  name: string;
  phone: string;
}

export interface Profile {
  uid: number;
  username: string;
  student_id: string;
  civility: string;
  firstname: string;
  name: string;
  maiden_name: string | null;
  birthday: number;
  nationality: string;
  birthplace: string;
  birth_country: string;
  address1: string;
  address2: string | null;
  city: string;
  zipcode: string;
  country: string;
  telephone: string;
  mobile: string;
  email: string;
  ine: string;
  emergency_contact: EmergencyContact;
  connected: boolean;
}

export interface Room {
  name: string;
  building?: string;
}

export interface Discipline {
  id: string;
  rc_id: number;
  name: string;
}

export interface AgendaEntry {
  reservation_id: number;
  name: string;
  type: string;
  start_date: number;
  end_date: number;
  username: string;
  lastUpdateDate: number;
  author: number;
  state: string;
  comment: string;
  teacher: string;
  promotion: string;
  modality: string;
  discipline: Discipline | null;
  rooms: Room[];
}

export interface Grade {
  id: string;
  username: string;
  subject: string;
  course: string;
  exam: number | null;
  average: number | null;
  ects: string;
  coef: string;
  year: number;
  teacher_civility: string;
  teacher_first_name: string;
  teacher_last_name: string;
  trimester: number;
  rc_id: number;
  lastUpdateDate: number;
  grades: number[];
}

export interface Absence {
  id: string;
  course_name: string;
  username: string;
  justified: boolean;
  trimester: number;
  year: number;
  date: number;
}

export interface Course {
  id: string;
  username: string;
  rc_id: number;
  name: string;
  nb_students: number;
  school_id: number;
  student_group_id: number;
  student_group_name: string;
  teacher: string;
  teacher_id: number;
  trimester: number;
  trimester_id: number;
  year: number;
}

export interface CourseFile {
  id: number;
  name: string;
  description?: string;
  upload_date?: number;
  size?: number;
  oc_id?: number;
}

export interface News {
  id: number;
  title: string;
  content: string;
  created_date: number;
  author: string;
  image_url?: string;
}

export interface NewsPage {
  content: News[];
  totalPages: number;
  totalElements: number;
  number: number;
  size: number;
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  course?: string;
  rc_id?: number;
  deadline?: number;
  groups?: ProjectGroup[];
}

export interface ProjectGroup {
  id: number;
  name: string;
  members?: ProjectMember[];
}

export interface ProjectMember {
  uid: number;
  firstname: string;
  name: string;
}

export interface ProjectMessage {
  id: number;
  message: string;
  author: string;
  author_uid: number;
  created_date: number;
}

export interface NotificationDelay {
  uid: number;
  notification_type_id: number;
  notification_type_name: string;
  delay_in_seconds: number;
  upd_date: number;
}

export interface SpeedMeeting {
  id: number;
  start_date: number;
  end_date: number;
  teacher?: string;
  location?: string;
  status?: string;
}

export interface AnnualDocument {
  id: number;
  name: string;
  description?: string;
  created_date?: number;
}

export interface Partner {
  id: number;
  name: string;
  description?: string;
  logo_url?: string;
  website?: string;
}

export interface ProjectStep {
  id: number;
  name: string;
  deadline?: number;
  project_name?: string;
}
