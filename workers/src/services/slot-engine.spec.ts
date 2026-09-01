import { describe, it, expect } from 'vitest';
import {
  overlaps,
  generateCandidates,
  isStaffAvailable,
  computeAvailability,
  type WorkingHoursEntry,
  type AppointmentEntry,
  type BlockedSlotEntry,
  type AvailabilityRequest,
} from './slot-engine';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
// America/Guatemala es UTC-6 sin horario de verano (DST).
// 2025-01-15 es miércoles (dayOfWeek = 3).
const GT = 'America/Guatemala';
const WED = '2025-01-15';

const gt = (hour: number, minute = 0): number =>
  Date.UTC(2025, 0, 15, hour + 6, minute);

const staff = [
  { id: 1, name: 'Ana' },
  { id: 2, name: 'Beto' },
];

const generalHours: WorkingHoursEntry = {
  userId: null,
  locationId: null,
  dayOfWeek: 3,
  startTime: '09:00',
  endTime: '17:00',
};

function request(overrides: Partial<AvailabilityRequest> = {}): AvailabilityRequest {
  return {
    date: WED,
    timezone: GT,
    serviceDurationMinutes: 30,
    intervalMinutes: 30,
    locationId: null,
    workingHours: [generalHours],
    appointments: [],
    blockedSlots: [],
    staff,
    staffId: 1,
    now: 0,
    ...overrides,
  };
}

describe('overlaps', () => {
  it('trata intervalos que se tocan en el borde como NO solapados (half-open)', () => {
    expect(overlaps(10_000, 20_000, 20_000, 30_000)).toBe(false);
  });

  it('detecta solapamiento real', () => {
    expect(overlaps(10_000, 20_000, 15_000, 25_000)).toBe(true);
  });

  it('detecta intervalos disjuntos', () => {
    expect(overlaps(10_000, 20_000, 30_000, 40_000)).toBe(false);
  });
});

describe('generateCandidates', () => {
  it('genera slots según horario laboral, duración e intervalo (15 min)', () => {
    const entry: WorkingHoursEntry = {
      userId: null,
      locationId: null,
      dayOfWeek: 3,
      startTime: '09:00',
      endTime: '10:00',
    };

    const slots = generateCandidates(entry, WED, GT, 30, 15);

    expect(slots.map((s) => s.startAt)).toEqual([
      gt(9, 0),
      gt(9, 15),
      gt(9, 30),
    ]);
    expect(slots.every((s) => s.endAt - s.startAt === 30 * 60_000)).toBe(true);
  });

  it('genera slots con intervalo de 30 minutos', () => {
    const entry: WorkingHoursEntry = {
      userId: null,
      locationId: null,
      dayOfWeek: 3,
      startTime: '09:00',
      endTime: '10:00',
    };

    const slots = generateCandidates(entry, WED, GT, 30, 30);

    expect(slots.map((s) => s.startAt)).toEqual([gt(9, 0), gt(9, 30)]);
  });

  it('no genera un slot que exceda el fin del horario laboral', () => {
    const entry: WorkingHoursEntry = {
      userId: null,
      locationId: null,
      dayOfWeek: 3,
      startTime: '09:00',
      endTime: '09:45',
    };

    const slots = generateCandidates(entry, WED, GT, 30, 15);

    expect(slots.map((s) => s.startAt)).toEqual([gt(9, 0), gt(9, 15)]);
  });

  it('excluye los slots que se solapan con el horario de descanso', () => {
    const entry: WorkingHoursEntry = {
      userId: null,
      locationId: null,
      dayOfWeek: 3,
      startTime: '09:00',
      endTime: '10:00',
      breakStartTime: '09:30',
      breakEndTime: '09:45',
    };

    const slots = generateCandidates(entry, WED, GT, 15, 15);

    expect(slots.map((s) => s.startAt)).toEqual([
      gt(9, 0),
      gt(9, 15),
      gt(9, 45),
    ]);
  });
});

describe('computeAvailability — citas existentes (startAt/endAt + bufferAfterMinutes)', () => {
  it('excluye el slot de un staff solapado por una cita, incluyendo su buffer', () => {
    const appointment: AppointmentEntry = {
      staffId: 1,
      locationId: null,
      startAt: gt(10, 0),
      endAt: gt(10, 30),
      bufferAfterMinutes: 15,
    };

    const result = computeAvailability(request({ appointments: [appointment] }));
    const starts = result.map((s) => s.startAt);

    // 09:30 termina antes de la cita (10:00) -> disponible
    expect(starts).toContain(gt(9, 30));
    // 10:00 solapa la cita -> ocupado
    expect(starts).not.toContain(gt(10, 0));
    // 10:30 solapa el buffer (hasta 10:45) -> ocupado
    expect(starts).not.toContain(gt(10, 30));
    // 11:00 está después del buffer (10:45) -> disponible
    expect(starts).toContain(gt(11, 0));
  });

  it('borde exacto: un slot que termina justo cuando empieza una cita está DISPONIBLE', () => {
    const appointment: AppointmentEntry = {
      staffId: 1,
      locationId: null,
      startAt: gt(10, 30),
      endAt: gt(11, 0),
      bufferAfterMinutes: 0,
    };

    const result = computeAvailability(request({ appointments: [appointment] }));
    const starts = result.map((s) => s.startAt);

    expect(starts).toContain(gt(10, 0));
    expect(starts).not.toContain(gt(10, 30));
  });
});

describe('computeAvailability — bloqueos de horario', () => {
  it('excluye slots bloqueados para toda la empresa (userId = null)', () => {
    const block: BlockedSlotEntry = {
      userId: null,
      locationId: null,
      startAt: gt(9, 0),
      endAt: gt(9, 30),
    };

    const result = computeAvailability(request({ blockedSlots: [block] }));
    const starts = result.map((s) => s.startAt);

    expect(starts).not.toContain(gt(9, 0));
    expect(starts).toContain(gt(9, 30));
  });

  it('aplica un bloqueo específico de staff solo a ese staff', () => {
    const block: BlockedSlotEntry = {
      userId: 1,
      locationId: null,
      startAt: gt(9, 0),
      endAt: gt(9, 30),
    };

    // staffId = 2 no está bloqueado
    const result = computeAvailability(request({ blockedSlots: [block], staffId: 2 }));
    expect(result.map((s) => s.startAt)).toContain(gt(9, 0));
  });
});

describe('computeAvailability — "Cualquiera disponible" (staffId = null)', () => {
  it('devuelve el slot si AL MENOS UN staff tiene disponibilidad', () => {
    const busyAna: AppointmentEntry = {
      staffId: 1,
      locationId: null,
      startAt: gt(9, 0),
      endAt: gt(9, 30),
      bufferAfterMinutes: 0,
    };

    const result = computeAvailability(request({ staffId: null, appointments: [busyAna] }));

    expect(result.map((s) => s.startAt)).toContain(gt(9, 0));
    expect(result.find((s) => s.startAt === gt(9, 0))?.staffId).toBeNull();
  });

  it('no devuelve el slot cuando TODOS los staff están ocupados', () => {
    const appointments: AppointmentEntry[] = [
      { staffId: 1, locationId: null, startAt: gt(9, 0), endAt: gt(9, 30), bufferAfterMinutes: 0 },
      { staffId: 2, locationId: null, startAt: gt(9, 0), endAt: gt(9, 30), bufferAfterMinutes: 0 },
    ];

    const result = computeAvailability(request({ staffId: null, appointments }));

    expect(result.map((s) => s.startAt)).not.toContain(gt(9, 0));
  });
});

describe('computeAvailability — horario laboral por staff', () => {
  it('usa el horario específico del staff y cae al general cuando no existe', () => {
    const workingHours: WorkingHoursEntry[] = [
      generalHours,
      { userId: 1, locationId: null, dayOfWeek: 3, startTime: '10:00', endTime: '11:00' },
    ];

    const result = computeAvailability(
      request({ workingHours, staffId: 1, intervalMinutes: 30 }),
    );
    const starts = result.map((s) => s.startAt);

    // Ana no trabaja a las 09:00 (su horario específico empieza a las 10:00)
    expect(starts).not.toContain(gt(9, 0));
    expect(starts).toContain(gt(10, 0));
  });
});

describe('computeAvailability — timezones IANA', () => {
  it('interpreta el horario laboral en el timezone IANA configurado', () => {
    const entry: WorkingHoursEntry = {
      userId: null,
      locationId: null,
      dayOfWeek: 3,
      startTime: '09:00',
      endTime: '09:30',
    };

    const slots = generateCandidates(entry, WED, GT, 30, 30);

    // Guatemala (UTC-6): 09:00 local == 15:00 UTC
    expect(slots[0].startAt).toBe(Date.UTC(2025, 0, 15, 15, 0));
  });

  it('respeta el horario de verano (DST) en timezones que lo aplican', () => {
    const entry: WorkingHoursEntry = {
      userId: null,
      locationId: null,
      dayOfWeek: 3,
      startTime: '09:00',
      endTime: '09:30',
    };

    // Invierno (EST, UTC-5): 09:00 == 14:00 UTC
    const winter = generateCandidates(entry, '2025-01-15', 'America/New_York', 30, 30);
    expect(winter[0].startAt).toBe(Date.UTC(2025, 0, 15, 14, 0));

    // Verano (EDT, UTC-4): 09:00 == 13:00 UTC (2025-07-15 es martes, dayOfWeek = 2)
    const summerEntry: WorkingHoursEntry = { ...entry, dayOfWeek: 2 };
    const summer = generateCandidates(summerEntry, '2025-07-15', 'America/New_York', 30, 30);
    expect(summer[0].startAt).toBe(Date.UTC(2025, 6, 15, 13, 0));
  });
});

describe('computeAvailability — filtrado de slots pasados', () => {
  it('descarta los slots cuyo startAt es anterior o igual al instante de referencia', () => {
    const result = computeAvailability(request({ now: gt(10, 0) }));
    const starts = result.map((s) => s.startAt);

    expect(starts).not.toContain(gt(9, 0));
    expect(starts).not.toContain(gt(9, 30));
    // Borde: startAt === now también se descarta.
    expect(starts).not.toContain(gt(10, 0));
    expect(starts).toContain(gt(10, 30));
    expect(starts).toContain(gt(11, 0));
  });
});

describe('validación de entrada', () => {
  it('lanza un error si la duración o el intervalo no son positivos', () => {
    expect(() =>
      computeAvailability(request({ serviceDurationMinutes: 0 })),
    ).toThrow();
    expect(() => computeAvailability(request({ intervalMinutes: 0 }))).toThrow();
  });

  it('isStaffAvailable devuelve false si el horario del staff no cubre el slot', () => {
    const slot = { startAt: gt(9, 0), endAt: gt(9, 30) };
    const workingHours: WorkingHoursEntry[] = [
      { userId: 1, locationId: null, dayOfWeek: 3, startTime: '10:00', endTime: '11:00' },
    ];

    expect(
      isStaffAvailable(1, slot, request({ workingHours })),
    ).toBe(false);
  });
});

describe('computeAvailability — ubicación (locationId)', () => {
  it('en "cualquiera disponible" solo considera staff asignado al lugar', () => {
    // Solo Ana (1) cubre el lugar 10; Beto (2) no.
    const staffByLocation = new Map([[10, [1]]]);
    // Bloquea a Ana a las 9:00; Beto está libre pero no cubre el lugar 10.
    const block: BlockedSlotEntry = {
      userId: 1,
      locationId: null,
      startAt: gt(9, 0),
      endAt: gt(9, 30),
    };

    const result = computeAvailability(
      request({ staffId: null, locationId: 10, staffByLocation, blockedSlots: [block] }),
    );

    // Beto (libre) no cuenta -> 9:00 no disponible; 9:30 sí (Ana ya libre).
    expect(result.map((s) => s.startAt)).not.toContain(gt(9, 0));
    expect(result.map((s) => s.startAt)).toContain(gt(9, 30));
  });

  it('aplica solo horarios generales o del lugar consultado', () => {
    const workingHours: WorkingHoursEntry[] = [
      { userId: null, locationId: 5, dayOfWeek: 3, startTime: '09:00', endTime: '10:00' },
    ];

    // El horario pertenece al lugar 5, no al 10.
    expect(
      computeAvailability(request({ workingHours, locationId: 10, staffId: 1 })),
    ).toEqual([]);
    expect(
      computeAvailability(request({ workingHours, locationId: 5, staffId: 1 })).map((s) => s.startAt),
    ).toContain(gt(9, 0));
  });

  it('aplica bloqueos solo en su lugar (o bloqueos generales)', () => {
    const blockLocation5: BlockedSlotEntry = {
      userId: null,
      locationId: 5,
      startAt: gt(9, 0),
      endAt: gt(9, 30),
    };

    // El bloqueo del lugar 5 no afecta al lugar 10.
    expect(
      computeAvailability(
        request({ blockedSlots: [blockLocation5], locationId: 10, staffId: 1 }),
      ).map((s) => s.startAt),
    ).toContain(gt(9, 0));
    // Sí afecta al lugar 5.
    expect(
      computeAvailability(
        request({ blockedSlots: [blockLocation5], locationId: 5, staffId: 1 }),
      ).map((s) => s.startAt),
    ).not.toContain(gt(9, 0));

    // Un bloqueo general (locationId null) aplica en cualquier lugar.
    const blockGeneral: BlockedSlotEntry = {
      userId: null,
      locationId: null,
      startAt: gt(9, 0),
      endAt: gt(9, 30),
    };
    expect(
      computeAvailability(
        request({ blockedSlots: [blockGeneral], locationId: 5, staffId: 1 }),
      ).map((s) => s.startAt),
    ).not.toContain(gt(9, 0));
  });

  it('una cita solo ocupa slot en su lugar (o si es general)', () => {
    const appointment: AppointmentEntry = {
      staffId: 1,
      locationId: 5,
      startAt: gt(9, 0),
      endAt: gt(9, 30),
      bufferAfterMinutes: 0,
    };

    // Cita en lugar 5 no bloquea al lugar 10.
    expect(
      computeAvailability(
        request({ appointments: [appointment], locationId: 10, staffId: 1 }),
      ).map((s) => s.startAt),
    ).toContain(gt(9, 0));
    // Sí bloquea al lugar 5.
    expect(
      computeAvailability(
        request({ appointments: [appointment], locationId: 5, staffId: 1 }),
      ).map((s) => s.startAt),
    ).not.toContain(gt(9, 0));
  });

  it('sin locationId (null) no filtra por ubicación (compatibilidad hacia atrás)', () => {
    const workingHours: WorkingHoursEntry[] = [
      { userId: null, locationId: 5, dayOfWeek: 3, startTime: '09:00', endTime: '10:00' },
    ];

    // Sin locationId, la entrada del lugar 5 se considera (sin filtro).
    const result = computeAvailability(request({ workingHours, staffId: 1 }));
    expect(result.map((s) => s.startAt)).toContain(gt(9, 0));
  });
});
