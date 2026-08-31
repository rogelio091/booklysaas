/**
 * Slot Engine — disponibilidad de citas.
 *
 * Módulo puro y tipado, sin dependencias de base de datos ni de framework.
 * Todas las funciones trabajan con:
 *   - tiempos como epoch en milisegundos UTC (números enteros),
 *   - intervalos half-open `[startAt, endAt)` (el final NO se solapa con el inicio),
 *   - horarios laborales expresados como "HH:MM" interpretados en un timezone IANA.
 *
 * Con esto se garantiza que un slot que termina exactamente cuando empieza una cita
 * ocupada siga siendo DISPONIBLE.
 */

// ---------------------------------------------------------------------------
// Tipos de dominio
// ---------------------------------------------------------------------------

/** Entrada de horario laboral (general con `userId = null` o específica de staff). */
export interface WorkingHoursEntry {
  /** `null` para horario general de la empresa; id del staff para horario específico. */
  userId: number | null;
  /** Lugar al que aplica el horario. `null` = horario general de la empresa (aplica a todos). */
  locationId: number | null;
  /** 0 (Domingo) - 6 (Sábado). */
  dayOfWeek: number;
  /** Hora de inicio en formato "HH:MM" (24h) en el timezone de la empresa. */
  startTime: string;
  /** Hora de fin en formato "HH:MM" (24h) en el timezone de la empresa. */
  endTime: string;
  /** Inicio del descanso en formato "HH:MM" (opcional). */
  breakStartTime?: string | null;
  /** Fin del descanso en formato "HH:MM" (opcional). */
  breakEndTime?: string | null;
  /** Si es `false`, la entrada se ignora. Por defecto se considera activa. */
  isActive?: boolean;
}

/** Cita existente. `bufferAfterMinutes` extiende la ocupación después de `endAt`. */
export interface AppointmentEntry {
  /** Staff dueño de la cita. `null` = cita sin asignar (no bloquea a ningún staff). */
  staffId: number | null;
  /** Lugar de la cita. `null` = cita sin lugar (general, ocupa en todos los lugares). */
  locationId: number | null;
  startAt: number;
  endAt: number;
  /** Buffer después de la cita (equivale a `appointments.bufferMinutes` / `services.bufferAfterMinutes`). */
  bufferAfterMinutes: number;
}

/** Bloqueo de horario (general `userId = null` o específico de staff). */
export interface BlockedSlotEntry {
  userId: number | null;
  /** Lugar del bloqueo. `null` = bloqueo general (aplica a todos los lugares). */
  locationId: number | null;
  startAt: number;
  endAt: number;
}

/** Miembro del staff candidato a atender un servicio. */
export interface StaffEntry {
  id: number;
  name: string | null;
}

/** Slot candidato (rango half-open). */
export interface SlotCandidate {
  startAt: number;
  endAt: number;
}

/** Slot disponible devuelto por el motor. */
export interface AvailabilitySlot extends SlotCandidate {
  /** Staff asignado, o `null` cuando se consultó "cualquiera disponible". */
  staffId: number | null;
  staffName: string | null;
}

export interface AvailabilityRequest {
  /** Fecha a consultar en formato "YYYY-MM-DD", interpretada en el timezone de la empresa. */
  date: string;
  /** Timezone IANA de la empresa (ej. "America/Guatemala"). */
  timezone: string;
  /** Duración del servicio en minutos. */
  serviceDurationMinutes: number;
  /** Granularidad de generación de slots en minutos (ej. 15 o 30). */
  intervalMinutes: number;
  workingHours: WorkingHoursEntry[];
  appointments: AppointmentEntry[];
  blockedSlots: BlockedSlotEntry[];
  staff: StaffEntry[];
  /** Staff solicitado. `null`/omitido = "cualquiera disponible". */
  staffId?: number | null;
  /** Lugar consultado. `null`/omitido = sin filtro de ubicación (comportamiento legacy). */
  locationId: number | null;
  /**
   * Mapa `locationId -> staffIds` asignados a ese lugar (pivot `staff_locations`).
   * Se usa en "cualquiera disponible" para restringir el staff al lugar consultado.
   */
  staffByLocation?: Map<number, number[]>;
}

// ---------------------------------------------------------------------------
// Solapamiento de intervalos (half-open)
// ---------------------------------------------------------------------------

/**
 * Devuelve `true` si `[aStart, aEnd)` se solapa con `[bStart, bEnd)`.
 * Los intervalos que solo se tocan en el borde (aEnd === bStart) NO se solapan.
 */
export function overlaps(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// ---------------------------------------------------------------------------
// Utilidades de fecha y timezone IANA
// ---------------------------------------------------------------------------

interface ParsedDate {
  year: number;
  /** 0-based (enero = 0). */
  monthIndex: number;
  day: number;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDate(date: string): ParsedDate {
  const match = DATE_RE.exec(date);
  if (!match) {
    throw new Error(`Fecha inválida: "${date}". Formato esperado: YYYY-MM-DD`);
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);

  const probe = new Date(Date.UTC(year, monthIndex, day));
  const isValid =
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === monthIndex &&
    probe.getUTCDate() === day;

  if (!isValid) {
    throw new Error(`Fecha inválida: "${date}"`);
  }

  return { year, monthIndex, day };
}

const dateTimeFormatCache = new Map<string, Intl.DateTimeFormat>();

function getDateTimeFormat(timeZone: string): Intl.DateTimeFormat {
  let formatter = dateTimeFormatCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    dateTimeFormatCache.set(timeZone, formatter);
  }
  return formatter;
}

/**
 * Offset del timezone en ms para un instante dado: `wallClockAsUtc - instantUtc`.
 * Para America/Guatemala (UTC-6) devuelve `-6 * 3_600_000`.
 */
function getTimeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = getDateTimeFormat(timeZone).formatToParts(instant);
  const values: Record<string, number> = {};

  for (const part of parts) {
    if (part.type !== 'literal') {
      values[part.type] = Number(part.value);
    }
  }

  // Algunos runtimes pueden emitir "24" para medianoche; normalizamos a 0.
  const hour = values.hour % 24;
  const asUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    hour,
    values.minute,
    values.second,
  );

  return asUtc - instant.getTime();
}

/**
 * Convierte un horario local "HH:MM" de una fecha (en un timezone IANA) a epoch ms UTC.
 * Itera el cálculo del offset para resolver correctamente transiciones de DST.
 */
function localTimeToUtc(
  year: number,
  monthIndex: number,
  day: number,
  time: string,
  timeZone: string,
): number {
  const [hourStr, minuteStr] = time.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr ?? '0');

  const wallAsUtc = Date.UTC(year, monthIndex, day, hour, minute);

  let result = wallAsUtc;
  for (let i = 0; i < 3; i += 1) {
    const offset = getTimeZoneOffsetMs(new Date(result), timeZone);
    const next = wallAsUtc - offset;
    if (next === result) break;
    result = next;
  }

  return result;
}

/**
 * Día de la semana (0=Domingo ... 6=Sábado) de una fecha de calendario.
 * El día de la semana es una propiedad del par (año, mes, día), independiente del timezone.
 */
function getDayOfWeek(year: number, monthIndex: number, day: number): number {
  return new Date(Date.UTC(year, monthIndex, day)).getUTCDay();
}

// ---------------------------------------------------------------------------
// Generación de candidatos
// ---------------------------------------------------------------------------

/**
 * Genera los slots candidatos de una única entrada de horario laboral para una fecha,
 * respetando duración, intervalo y descanso.
 */
export function generateCandidates(
  entry: WorkingHoursEntry,
  date: string,
  timezone: string,
  serviceDurationMinutes: number,
  intervalMinutes: number,
): SlotCandidate[] {
  const { year, monthIndex, day } = parseDate(date);
  const startAt = localTimeToUtc(year, monthIndex, day, entry.startTime, timezone);
  const endAt = localTimeToUtc(year, monthIndex, day, entry.endTime, timezone);

  const breakStartAt =
    entry.breakStartTime != null
      ? localTimeToUtc(year, monthIndex, day, entry.breakStartTime, timezone)
      : null;
  const breakEndAt =
    entry.breakEndTime != null
      ? localTimeToUtc(year, monthIndex, day, entry.breakEndTime, timezone)
      : null;

  const durationMs = serviceDurationMinutes * 60_000;
  const intervalMs = intervalMinutes * 60_000;

  const candidates: SlotCandidate[] = [];
  for (let s = startAt; s + durationMs <= endAt; s += intervalMs) {
    const e = s + durationMs;

    const overlapsBreak =
      breakStartAt != null &&
      breakEndAt != null &&
      overlaps(s, e, breakStartAt, breakEndAt);

    if (!overlapsBreak) {
      candidates.push({ startAt: s, endAt: e });
    }
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Resolución de horario laboral por staff
// ---------------------------------------------------------------------------

/**
 * Resuelve el horario laboral de un staff para un día: usa la entrada específica
 * del staff si existe; si no, cae a la entrada general (`userId = null`).
 */
export function resolveWorkingHoursForStaff(
  workingHours: WorkingHoursEntry[],
  staffId: number,
  dayOfWeek: number,
): WorkingHoursEntry | undefined {
  const active = workingHours.filter(
    (w) => w.dayOfWeek === dayOfWeek && w.isActive !== false,
  );

  const specific = active.find((w) => w.userId === staffId);
  if (specific) return specific;

  return active.find((w) => w.userId === null);
}

function isWithinWorkingHours(
  slot: SlotCandidate,
  entry: WorkingHoursEntry,
  date: string,
  timezone: string,
): boolean {
  const { year, monthIndex, day } = parseDate(date);
  const startAt = localTimeToUtc(year, monthIndex, day, entry.startTime, timezone);
  const endAt = localTimeToUtc(year, monthIndex, day, entry.endTime, timezone);

  if (slot.startAt < startAt || slot.endAt > endAt) {
    return false;
  }

  if (entry.breakStartTime != null && entry.breakEndTime != null) {
    const breakStartAt = localTimeToUtc(
      year,
      monthIndex,
      day,
      entry.breakStartTime,
      timezone,
    );
    const breakEndAt = localTimeToUtc(
      year,
      monthIndex,
      day,
      entry.breakEndTime,
      timezone,
    );

    if (overlaps(slot.startAt, slot.endAt, breakStartAt, breakEndAt)) {
      return false;
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Disponibilidad por staff
// ---------------------------------------------------------------------------

/**
 * Indica si un staff puede atender un slot: cubre el horario laboral, no tiene
 * descanso en ese rango, no tiene bloqueos (generales o propios) y no tiene una
 * cita existente (incluyendo su buffer) que se solape.
 */
export function isStaffAvailable(
  staffId: number,
  slot: SlotCandidate,
  request: AvailabilityRequest,
): boolean {
  const { year, monthIndex, day } = parseDate(request.date);
  const dayOfWeek = getDayOfWeek(year, monthIndex, day);

  const entry = resolveWorkingHoursForStaff(
    request.workingHours,
    staffId,
    dayOfWeek,
  );

  if (!entry || !isWithinWorkingHours(slot, entry, request.date, request.timezone)) {
    return false;
  }

  for (const blocked of request.blockedSlots) {
    if (blocked.userId !== null && blocked.userId !== staffId) continue;
    if (overlaps(slot.startAt, slot.endAt, blocked.startAt, blocked.endAt)) {
      return false;
    }
  }

  for (const appointment of request.appointments) {
    if (appointment.staffId !== staffId) continue;

    const blockedUntil = appointment.endAt + appointment.bufferAfterMinutes * 60_000;
    if (overlaps(slot.startAt, slot.endAt, appointment.startAt, blockedUntil)) {
      return false;
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Disponibilidad completa
// ---------------------------------------------------------------------------

/**
 * Calcula la disponibilidad de slots para una fecha.
 *
 * - Con `staffId` numérico: devuelve solo los slots libres de ese staff.
 * - Con `staffId = null` (u omitido): devuelve un slot si AL MENOS UN staff
 *   está disponible (el slot resultante lleva `staffId = null`).
 * - Con `locationId` numérico: filtra horarios/bloqueos/citas por lugar y restringe
 *   el staff de "cualquiera disponible" a los asignados al lugar.
 */
export function computeAvailability(
  request: AvailabilityRequest,
): AvailabilitySlot[] {
  if (!Number.isInteger(request.serviceDurationMinutes) || request.serviceDurationMinutes <= 0) {
    throw new Error('serviceDurationMinutes debe ser un entero positivo');
  }
  if (!Number.isInteger(request.intervalMinutes) || request.intervalMinutes <= 0) {
    throw new Error('intervalMinutes debe ser un entero positivo');
  }

  const { year, monthIndex, day } = parseDate(request.date);
  const dayOfWeek = getDayOfWeek(year, monthIndex, day);

  const locationId = request.locationId ?? null;

  // Compatibilidad hacia atrás: sin locationId, todas las entradas aplican (como hoy).
  // Con locationId, solo aplican las entradas generales (locationId === null) o las del lugar.
  const workingHours =
    locationId == null
      ? request.workingHours
      : request.workingHours.filter(
          (w) => w.locationId == null || w.locationId === locationId,
        );
  const blockedSlots =
    locationId == null
      ? request.blockedSlots
      : request.blockedSlots.filter(
          (b) => b.locationId == null || b.locationId === locationId,
        );
  const appointments =
    locationId == null
      ? request.appointments
      : request.appointments.filter(
          (a) => a.locationId == null || a.locationId === locationId,
        );

  // En "cualquiera disponible", restringe el staff a los asignados al lugar consultado.
  const staff =
    request.staffId == null && locationId != null && request.staffByLocation
      ? (() => {
          const locationStaffIds = request.staffByLocation!.get(locationId);
          if (!locationStaffIds || locationStaffIds.length === 0) return [];
          const idSet = new Set(locationStaffIds);
          return request.staff.filter((s) => idSet.has(s.id));
        })()
      : request.staff;

  const effectiveRequest: AvailabilityRequest = {
    ...request,
    workingHours,
    blockedSlots,
    appointments,
    staff,
  };

  const relevantStaffIds = new Set<number>(staff.map((s) => s.id));
  if (request.staffId != null) {
    relevantStaffIds.add(request.staffId);
  }

  // Unión de los candidatos generados por cada entrada de horario (general y
  // específicas de staff relevantes). Luego se filtra por staff.
  const candidateStarts = new Set<number>();
  for (const entry of workingHours) {
    if (entry.dayOfWeek !== dayOfWeek) continue;
    if (entry.isActive === false) continue;
    if (entry.userId !== null && !relevantStaffIds.has(entry.userId)) continue;

    for (const candidate of generateCandidates(
      entry,
      request.date,
      request.timezone,
      request.serviceDurationMinutes,
      request.intervalMinutes,
    )) {
      candidateStarts.add(candidate.startAt);
    }
  }

  const durationMs = request.serviceDurationMinutes * 60_000;
  const sortedStarts = [...candidateStarts].sort((a, b) => a - b);

  const result: AvailabilitySlot[] = [];

  for (const startAt of sortedStarts) {
    const slot: SlotCandidate = { startAt, endAt: startAt + durationMs };

    if (request.staffId != null) {
      if (isStaffAvailable(request.staffId, slot, effectiveRequest)) {
        const staffName =
          request.staff.find((s) => s.id === request.staffId)?.name ?? null;
        result.push({
          startAt,
          endAt: slot.endAt,
          staffId: request.staffId,
          staffName,
        });
      }
    } else {
      const anyAvailable = staff.some((s) =>
        isStaffAvailable(s.id, slot, effectiveRequest),
      );
      if (anyAvailable) {
        result.push({ startAt, endAt: slot.endAt, staffId: null, staffName: null });
      }
    }
  }

  return result;
}
