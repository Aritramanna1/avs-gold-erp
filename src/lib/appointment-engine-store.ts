/**
 * Arivahly Venture Sphere (AVS) — Appointment Scheduling Engine
 * 
 * Appointment types:
 * General Consultation | Bridal Consultation | Custom Design | High-Value Client |
 * Gold Purchase / Exchange | Repair Handover | Delivery Collection
 */

export type AppointmentStatus =
  | 'Scheduled'
  | 'Confirmed'
  | 'Checked In'
  | 'Completed'
  | 'Cancelled'
  | 'No Show';

export type AppointmentType =
  | 'Bridal Consultation'
  | 'Custom Jewellery Design'
  | 'High-Value VIP Consultation'
  | 'General Consultation'
  | 'Gold Exchange / Valuation'
  | 'Repair Intake / Handover'
  | 'Order Delivery Collection';

export interface AppointmentRecord {
  id: string;
  appointmentCode: string; // e.g. AVS-APT-2026-0038
  customerName: string;
  phone: string;
  date: string; // YYYY-MM-DD
  timeSlot: string; // e.g. 11:30 AM
  durationMinutes: number;
  type: AppointmentType;
  purpose: string;
  assignedStaff: string;
  priority: 'VIP' | 'High' | 'Standard';
  status: AppointmentStatus;
  productsRequested?: string[];
  notes?: string;
  createdAt: string;
}

const STORAGE_KEY = 'avs_appointments_v1';

export function getSampleAppointments(): AppointmentRecord[] {
  return [
    {
      id: 'apt-1',
      appointmentCode: 'AVS-APT-2026-0041',
      customerName: 'Ananya Sengupta',
      phone: '+91 98301 22334',
      date: '2026-09-06',
      timeSlot: '11:30 AM',
      durationMinutes: 60,
      type: 'Bridal Consultation',
      purpose: 'Viewing 22K Royal Temple choker and antique matha patti',
      assignedStaff: 'Sanjay Verma',
      priority: 'VIP',
      status: 'Confirmed',
      productsRequested: ['AVS-G-2026-000102', 'AVS-G-2026-000105'],
      notes: 'Reserved VIP Private Viewing Room 1.',
      createdAt: '2026-09-04T12:00:00Z',
    },
    {
      id: 'apt-2',
      appointmentCode: 'AVS-APT-2026-0042',
      customerName: 'Vikramaditya Roy',
      phone: '+91 98401 55667',
      date: '2026-09-06',
      timeSlot: '03:00 PM',
      durationMinutes: 45,
      type: 'High-Value VIP Consultation',
      purpose: 'Solitaire Diamond Engagement Ring Selection',
      assignedStaff: 'Pooja Sen',
      priority: 'High',
      status: 'Scheduled',
      productsRequested: ['AVS-D-2026-000214'],
      notes: 'Customer budget ₹3,50,000.',
      createdAt: '2026-09-05T10:30:00Z',
    },
    {
      id: 'apt-3',
      appointmentCode: 'AVS-APT-2026-0043',
      customerName: 'Kavita Chawla',
      phone: '+91 97110 88442',
      date: '2026-09-06',
      timeSlot: '05:30 PM',
      durationMinutes: 30,
      type: 'Order Delivery Collection',
      purpose: 'Final pick-up of custom-crafted 18K Emerald Pendant',
      assignedStaff: 'Rohan Mehta',
      priority: 'Standard',
      status: 'Confirmed',
      productsRequested: ['AVS-G-2026-000309'],
      createdAt: '2026-09-05T16:00:00Z',
    },
  ];
}

export function getAppointments(): AppointmentRecord[] {
  if (typeof window === 'undefined') return getSampleAppointments();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = getSampleAppointments();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return getSampleAppointments();
  }
}

export function saveAppointments(appointments: AppointmentRecord[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appointments));
}
