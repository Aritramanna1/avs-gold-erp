import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAppointments, type AppointmentRecord } from "@/lib/appointment-engine-store";
import {
  Calendar,
  Clock,
  User,
  Phone,
  Plus,
  Crown,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/crm/appointments")({
  head: () => ({
    meta: [
      { title: "Appointments Desk · AVS CRM" },
      { name: "description", content: "Showroom appointment schedules and viewing room bookings." },
    ],
  }),
  component: AppointmentsPage,
});

function AppointmentsPage() {
  const [appointments, setAppointments] = useState<AppointmentRecord[]>(getAppointments);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PageHeader
          title="Showroom Appointment Desk"
          description="Manage VIP bridal viewings, custom design consultations, and pickup appointments."
        />
        <Button className="bg-gold hover:bg-gold/90 text-black font-semibold text-xs flex items-center gap-1.5 shrink-0">
          <Plus className="h-4 w-4" />
          Book Appointment
        </Button>
      </div>

      {/* Appointment Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {appointments.map((apt) => (
          <Card key={apt.id} className="p-5 border space-y-4 hover:border-gold/40 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {apt.appointmentCode}
                  </Badge>
                  {apt.priority === 'VIP' && (
                    <Badge className="bg-gold text-black text-[10px] font-bold flex items-center gap-1">
                      <Crown className="h-3 w-3" /> VIP
                    </Badge>
                  )}
                </div>
                <h3 className="font-bold text-sm text-foreground">{apt.customerName}</h3>
                <p className="text-xs text-muted-foreground font-mono">{apt.phone}</p>
              </div>

              <Badge variant="secondary" className="font-semibold text-xs">
                {apt.status}
              </Badge>
            </div>

            <div className="p-3 rounded-lg bg-muted/30 border space-y-1.5 text-xs">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <Calendar className="h-3.5 w-3.5 text-gold" />
                <span>{apt.date} · {apt.timeSlot}</span>
              </div>
              <div className="text-muted-foreground text-[11px]">
                Type: <span className="font-medium text-foreground">{apt.type}</span>
              </div>
              <div className="text-muted-foreground text-[11px]">
                Staff: <span className="font-medium text-foreground">{apt.assignedStaff}</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground line-clamp-2">
              {apt.purpose}
            </p>

            <div className="pt-2 border-t flex items-center justify-between">
              <Button variant="outline" size="sm" className="text-xs h-8">
                Reschedule
              </Button>
              <Button size="sm" className="bg-gold text-black font-semibold text-xs h-8">
                Check In
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
