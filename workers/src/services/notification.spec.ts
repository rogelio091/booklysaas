import { describe, it, expect } from 'vitest';
import {
  formatIcsDate,
  generateIcsContent,
  generateWhatsAppLink,
} from './notification';

describe('Notification & Calendar Service', () => {
  it('formatea correctamente una fecha ISO a formato VCALENDAR UTC', () => {
    const d = new Date('2026-08-21T14:30:00.000Z');
    expect(formatIcsDate(d)).toBe('20260821T143000Z');
  });

  it('genera un archivo VCALENDAR .ics válido con campos estándar', () => {
    const startAt = new Date('2026-08-21T14:00:00.000Z');
    const endAt = new Date('2026-08-21T14:45:00.000Z');

    const ics = generateIcsContent({
      uid: 'test-uid-123@bookly.dev',
      summary: 'Limpieza Dental Profunda',
      description: 'Cita con Dr. Carlos Morales',
      location: 'Clínica Dental Morales',
      startAt,
      endAt,
      organizerName: 'Clínica Dental Morales',
      organizerEmail: 'contacto@dental.com',
    });

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('UID:test-uid-123@bookly.dev');
    expect(ics).toContain('DTSTART:20260821T140000Z');
    expect(ics).toContain('DTEND:20260821T144500Z');
    expect(ics).toContain('SUMMARY:Limpieza Dental Profunda');
    expect(ics).toContain('LOCATION:Clínica Dental Morales');
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('genera correctamente un link profundo de WhatsApp', () => {
    const link = generateWhatsAppLink('+502 5555-1234', 'Hola, confirmando mi cita');
    expect(link).toBe('https://wa.me/50255551234?text=Hola%2C%20confirmando%20mi%20cita');
  });
});
