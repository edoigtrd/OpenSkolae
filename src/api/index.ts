import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from './client';
import type {
  AuthenticatedUser, Profile, AgendaEntry, Grade, Absence,
  Course, News, NewsPage, Project, ProjectGroup, ProjectMessage,
  NotificationDelay, SpeedMeeting, AnnualDocument, Partner,
  ProjectStep, CourseFile,
} from './types';

export const API = {
  getAccount: (token: string) =>
    apiGet<AuthenticatedUser>('/me', token),

  getProfile: (token: string) =>
    apiGet<Profile>('/me/profile', token),

  updateProfile: (token: string, data: Partial<Profile>) =>
    apiPut<Profile>('/me/profile', token, data),

  getYears: (token: string) =>
    apiGet<number[]>('/me/years', token),

  getTrimesterYears: (token: string) =>
    apiGet<any[]>('/me/trimesterYears', token),

  getClasses: (token: string, year: number) =>
    apiGet<any[]>(`/me/${year}/classes`, token),

  getStudents: (token: string, year: number) =>
    apiGet<any[]>(`/me/${year}/students`, token),

  getTeachers: (token: string, year: number) =>
    apiGet<any[]>(`/me/${year}/teachers`, token),

  getAgenda: (token: string, startMs: number, endMs: number) =>
    apiGet<AgendaEntry[]>('/me/agenda', token, { start: startMs, end: endMs }),

  getGrades: (token: string, year: number) =>
    apiGet<Grade[]>(`/me/${year}/grades`, token),

  getAbsences: (token: string, year: number) =>
    apiGet<Absence[]>(`/me/${year}/absences`, token),

  getCourses: (token: string, year: number) =>
    apiGet<Course[]>(`/me/${year}/courses`, token),

  getCourseFiles: (token: string, rcId: number) =>
    apiGet<CourseFile[]>(`/me/${rcId}/files`, token),

  getSyllabus: (token: string, rcId: number) =>
    apiGet<any[]>(`/me/${rcId}/syllabus`, token),

  getNews: (token: string, page = 0) =>
    apiGet<NewsPage>('/me/news', token, { page }),

  getNewsBanners: (token: string) =>
    apiGet<any>('/me/news/banners', token),

  getProjects: (token: string, year: number) =>
    apiGet<Project[]>(`/me/${year}/projects`, token),

  getProjectsByCourse: (token: string, rcId: number) =>
    apiGet<Project[]>(`/me/courses/${rcId}/projects`, token),

  getProject: (token: string, projectId: number) =>
    apiGet<Project>(`/me/projects/${projectId}`, token),

  getNextProjectSteps: (token: string) =>
    apiGet<ProjectStep[]>('/me/nextProjectSteps', token),

  getPracticals: (token: string, year: number) =>
    apiGet<any[]>(`/me/${year}/practicals`, token),

  joinProjectGroup: (token: string, rcId: number, projectId: number, groupId: number) =>
    apiPost<any>(`/me/courses/${rcId}/projects/${projectId}/groups/${groupId}`, token),

  quitProjectGroup: (token: string, rcId: number, projectId: number, groupId: number) =>
    apiDelete<any>(`/me/courses/${rcId}/projects/${projectId}/groups/${groupId}`, token),

  getGroupMessages: (token: string, groupId: number) =>
    apiGet<ProjectMessage[]>(`/me/projectGroups/${groupId}/messages`, token),

  sendGroupMessage: (token: string, groupId: number, message: string) =>
    apiPost<ProjectMessage[]>(`/me/projectGroups/${groupId}/messages`, token, {
      project_group_id: groupId,
      message,
    }),

  deleteGroupMessage: (token: string, groupId: number, messageId: number) =>
    apiDelete<any>(`/me/projectGroups/${groupId}/messages/${messageId}`, token),

  getAnnualDocuments: (token: string, year: number) =>
    apiGet<AnnualDocument[]>(`/me/${year}/annualDocuments`, token),

  getPartners: (token: string) =>
    apiGet<Partner[]>('/me/partners', token),

  submitSuggestion: (token: string, content: string) =>
    apiPost<any>('/me/suggestion', token, { application_id: 'skolae-app', content }),

  getNotificationDelays: (token: string) =>
    apiGet<NotificationDelay[]>('/me/notificationsDelays', token),

  upsertNotificationDelay: (token: string, notificationTypeId: number, delaySeconds: number) =>
    apiPost<NotificationDelay>('/me/notificationsDelays', token, {
      notification_type_id: notificationTypeId,
      delay_in_seconds: delaySeconds,
    }),

  deleteNotificationDelay: (token: string, notificationTypeId: number) =>
    apiDelete<any>(`/me/notificationsDelays/${notificationTypeId}`, token),

  getSpeedMeetings: (token: string, startMs?: number, endMs?: number) => {
    const params: Record<string, number> = {};
    if (startMs) params.start = startMs;
    if (endMs) params.end = endMs;
    return apiGet<SpeedMeeting[]>('/me/speedMeetingAppointments', token, params);
  },

  validateInternalRules: (token: string) =>
    apiPatch<any>('/me/internalrules', token),
};
