import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  PublicCompanyDto,
  PublicServiceDto,
  SlotDto,
  CreateBookingDto,
} from '@bookly/contracts';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly http = inject(HttpClient);

  // 1. Perfil de empresa
  getCompany(slug: string): Observable<ApiResponse<PublicCompanyDto>> {
    return this.http.get<ApiResponse<PublicCompanyDto>>(`/api/public/${slug}/company`);
  }

  // 2. Catálogo de servicios
  getServices(slug: string): Observable<ApiResponse<PublicServiceDto[]>> {
    return this.http.get<ApiResponse<PublicServiceDto[]>>(`/api/public/${slug}/services`);
  }

  // 3. Disponibilidad de slots
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
      `/api/public/${slug}/availability`,
      { params },
    );
  }

  // 4. Crear reserva
  createBooking(
    slug: string,
    booking: CreateBookingDto,
  ): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`/api/public/${slug}/book`, booking);
  }
}
