import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import type { PublicLocationDto } from '@bookly/contracts';
import { BookingComponent } from './booking.component';
import { ApiService } from '../../core/services/api.service';
import { ThemeService, BooklyTheme } from '../../core/theme/theme.service';

const fixedLocation: PublicLocationDto = {
  id: 1,
  name: 'Clínica Central',
  type: 'fixed',
  slug: 'demo',
};

const mobileLocation: PublicLocationDto = {
  id: 2,
  name: 'A domicilio',
  type: 'mobile',
  slug: 'demo',
};

describe('BookingComponent', () => {
  // Accessor for protected members (signals + computed) under test.
  let cmp: any;

  const apiMock = {
    getCompany: vi.fn(() => of({ success: true, data: null })),
    getPublicLocations: vi.fn(() => of({ success: true, data: [] })),
    getServices: vi.fn(() => of({ success: true, data: [] })),
    getStaff: vi.fn(() => of({ success: true, data: [] })),
    getAvailability: vi.fn(() =>
      of({ success: true, data: { date: '', timezone: 'UTC', slots: [] } }),
    ),
    createBooking: vi.fn(() => of({ success: true, data: null })),
  };

  const routeMock = {
    snapshot: { paramMap: { get: (_key: string) => 'demo' } },
  };

  const themeMock = {
    currentTheme: signal<BooklyTheme>('midnight-emerald'),
    setTheme: vi.fn(),
    initFromCompany: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BookingComponent],
      providers: [
        { provide: ApiService, useValue: apiMock },
        { provide: ActivatedRoute, useValue: routeMock },
        { provide: ThemeService, useValue: themeMock },
      ],
    }).compileComponents();

    cmp = TestBed.createComponent(BookingComponent).componentInstance as any;

    // Navigate to the last step ('data'). With no locations, stepOrder omits
    // 'location', so the order is ['service','staff','datetime','data'].
    cmp.currentIndex.set(cmp.stepOrder().length - 1);
  });

  describe('canProceed for the "data" step', () => {
    it('is false when all fields are empty (non-mobile)', () => {
      cmp.selectedLocation.set(null);
      cmp.customerName.set('');
      cmp.customerPhone.set('');
      cmp.customerEmail.set('');

      expect(cmp.canProceed()).toBe(false);
    });

    it('is false when customerName is shorter than 2 chars', () => {
      cmp.selectedLocation.set(null);
      cmp.customerName.set('A');
      cmp.customerPhone.set('12345678');
      cmp.customerEmail.set('a@b.com');

      expect(cmp.canProceed()).toBe(false);
    });

    it('is false when customerPhone is shorter than 8 chars', () => {
      cmp.selectedLocation.set(null);
      cmp.customerName.set('Juan');
      cmp.customerPhone.set('1234');
      cmp.customerEmail.set('a@b.com');

      expect(cmp.canProceed()).toBe(false);
    });

    it('is false when customerEmail has no @', () => {
      cmp.selectedLocation.set(null);
      cmp.customerName.set('Juan');
      cmp.customerPhone.set('12345678');
      cmp.customerEmail.set('juan.mail.com');

      expect(cmp.canProceed()).toBe(false);
    });

    it('is true when name>=2, phone>=8 and email has @ (non-mobile)', () => {
      cmp.selectedLocation.set(null);
      cmp.customerName.set('Juan Pérez');
      cmp.customerPhone.set('50212345678');
      cmp.customerEmail.set('juan@mail.com');

      expect(cmp.canProceed()).toBe(true);
    });

    it('is false for a mobile location without a >=5 chars address', () => {
      cmp.selectedLocation.set(mobileLocation);
      cmp.customerName.set('Juan Pérez');
      cmp.customerPhone.set('50212345678');
      cmp.customerEmail.set('juan@mail.com');
      cmp.customerAddress.set('');

      expect(cmp.canProceed()).toBe(false);
    });

    it('is true for a mobile location with a >=5 chars address', () => {
      cmp.selectedLocation.set(mobileLocation);
      cmp.customerName.set('Juan Pérez');
      cmp.customerPhone.set('50212345678');
      cmp.customerEmail.set('juan@mail.com');
      cmp.customerAddress.set('Calle 123, zona 10');

      expect(cmp.canProceed()).toBe(true);
    });
  });

  describe('signal reactivity regression', () => {
    it('setting name/phone/email flips canProceed from false to true', () => {
      cmp.selectedLocation.set(null);
      cmp.customerName.set('');
      cmp.customerPhone.set('');
      cmp.customerEmail.set('');
      expect(cmp.canProceed()).toBe(false);

      cmp.customerName.set('María Gómez');
      cmp.customerPhone.set('50212345678');
      cmp.customerEmail.set('maria@example.com');
      expect(cmp.canProceed()).toBe(true);
    });
  });

  describe('wizard stepOrder', () => {
    it('omits "location" when there is at most one location and keeps "data" last', () => {
      cmp.locations.set([fixedLocation]);

      const order = cmp.stepOrder();

      expect(order).not.toContain('location');
      expect(order[order.length - 1]).toBe('data');
    });

    it('includes "location" when there is more than one location and keeps "data" last', () => {
      cmp.locations.set([fixedLocation, mobileLocation]);

      const order = cmp.stepOrder();

      expect(order[0]).toBe('location');
      expect(order[order.length - 1]).toBe('data');
    });
  });
});
