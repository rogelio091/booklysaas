import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  AppointmentAdminDto,
  PublicCompanyDto,
  PublicServiceDto,
  PublicStaffDto,
  SlotDto,
  CreateBookingDto,
  CreateServiceDto,
  LoginRequestDto,
  AuthResponseDto,
  ServiceResponseDto,
  StaffResponseDto,
  CreateAdminAppointmentDto,
  SetWorkingHoursDto,
  UpdateAppointmentStatusDto,
  UpdateServiceDto,
} from '@bookly/contracts';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  };
}

// Elemento de horario laboral devuelto por el backend (GET /schedule/working-hours)
export interface WorkingHourDto {
  id: number;
  companyId: number;
  userId: number | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakStartTime: string | null;
  breakEndTime: string | null;
  isActive: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  // 1. Perfil de empresa
  getCompany(slug: string): Observable<ApiResponse<PublicCompanyDto>> {
    return this.http.get<ApiResponse<PublicCompanyDto>>(`${this.baseUrl}/public/${slug}/company`);
  }

  // 2. Catálogo de servicios
  getServices(slug: string): Observable<ApiResponse<PublicServiceDto[]>> {
    return this.http.get<ApiResponse<PublicServiceDto[]>>(`${this.baseUrl}/public/${slug}/services`);
  }

  // 3. Staff disponible
  getStaff(slug: string): Observable<ApiResponse<PublicStaffDto[]>> {
    return this.http.get<ApiResponse<PublicStaffDto[]>>(`${this.baseUrl}/public/${slug}/staff`);
  }

  // 4. Disponibilidad de slots
  getAvailability(
    slug: string,
    serviceId: number,
    date: string,
    staffId?: number | null,
  ): Observable<ApiResponse<{ date: string; timezone: string; slots: SlotDto[] }>> {
    const params: Record<string, string> = {
      serviceId: String(serviceId),
      date,
    };
    if (staffId) {
      params['staffId'] = String(staffId);
    }
    return this.http.get<ApiResponse<{ date: string; timezone: string; slots: SlotDto[] }>>(
      `${this.baseUrl}/public/${slug}/availability`,
      { params },
    );
  }

  // 5. Crear reserva
  createBooking(
    slug: string,
    booking: CreateBookingDto,
  ): Observable<ApiResponse<{ appointmentId: number; status: string; customerName: string; serviceName: string }>> {
    return this.http.post<ApiResponse<{ appointmentId: number; status: string; customerName: string; serviceName: string }>>(`${this.baseUrl}/public/${slug}/book`, booking);
  }

  // 6. Login de administración
  login(credentials: LoginRequestDto): Observable<ApiResponse<AuthResponseDto>> {
    return this.http.post<ApiResponse<AuthResponseDto>>(`${this.baseUrl}/auth/login`, credentials);
  }

  // 7. Catálogo de servicios (admin, autenticado)
  getAdminServices(): Observable<ApiResponse<ServiceResponseDto[]>> {
    return this.http.get<ApiResponse<ServiceResponseDto[]>>(`${this.baseUrl}/services`);
  }

  // 7b. Crear servicio (admin, autenticado)
  createService(data: CreateServiceDto): Observable<ApiResponse<ServiceResponseDto>> {
    return this.http.post<ApiResponse<ServiceResponseDto>>(`${this.baseUrl}/services`, data);
  }

  // 7c. Actualizar servicio (admin, autenticado)
  updateService(id: number, data: UpdateServiceDto): Observable<ApiResponse<ServiceResponseDto>> {
    return this.http.put<ApiResponse<ServiceResponseDto>>(`${this.baseUrl}/services/${id}`, data);
  }

  // 8. Staff del tenant (admin, autenticado)
  getAdminStaff(): Observable<ApiResponse<StaffResponseDto[]>> {
    return this.http.get<ApiResponse<StaffResponseDto[]>>(`${this.baseUrl}/staff`);
  }

  // 9. Crear cita desde el panel admin
  createAppointment(
    appointment: CreateAdminAppointmentDto,
  ): Observable<ApiResponse<{ id: number }>> {
    return this.http.post<ApiResponse<{ id: number }>>(`${this.baseUrl}/appointments`, appointment);
  }

  // 10. Horarios laborales (admin, horario general de empresa)
  getWorkingHours(): Observable<ApiResponse<WorkingHourDto[]>> {
    return this.http.get<ApiResponse<WorkingHourDto[]>>(`${this.baseUrl}/schedule/working-hours`);
  }

  saveWorkingHours(
    hours: SetWorkingHoursDto['hours'],
  ): Observable<{ success: boolean; message?: string }> {
    return this.http.post<{ success: boolean; message?: string }>(
      `${this.baseUrl}/schedule/working-hours`,
      { hours },
    );
  }

  // 11. Cambiar estado de una cita (admin, autenticado)
  updateAppointmentStatus(
    id: number,
    status: UpdateAppointmentStatusDto['status'],
    cancellationReason?: string,
  ): Observable<ApiResponse<AppointmentAdminDto>> {
    const body: UpdateAppointmentStatusDto = { status };
    if (cancellationReason?.trim()) {
      body.cancellationReason = cancellationReason.trim();
    }
    return this.http.patch<ApiResponse<AppointmentAdminDto>>(
      `${this.baseUrl}/appointments/${id}/status`,
      body,
    );
  }

  // 12. Eliminar físicamente una cita (admin, autenticado)
  deleteAppointment(id: number): Observable<ApiResponse<{ id: number }>> {
    return this.http.delete<ApiResponse<{ id: number }>>(`${this.baseUrl}/appointments/${id}`);
  }
}
