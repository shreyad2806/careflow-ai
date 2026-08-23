'use client';

import React, { useState } from 'react';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Pill, Clock, CheckCircle, AlertTriangle, Plus, Calendar, ChevronRight } from 'lucide-react';

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  nextDose: string;
  taken: boolean;
  instructions?: string;
  remainingDoses: number;
}

interface MedicationReminderProps {
  medications: Medication[];
  onMarkAsTaken: (id: string) => void;
  onAddMedication: () => void;
}

export default function MedicationReminder({
  medications,
  onMarkAsTaken,
  onAddMedication,
}: MedicationReminderProps) {
  const [showAll, setShowAll] = useState(false);
  const upcomingMedications = medications.filter(m => !m.taken);
  const displayedMedications = showAll ? medications : upcomingMedications.slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Pill size={20} className="text-purple-600" />
            Medication Reminders
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onAddMedication}>
            <Plus size={16} className="mr-1" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {displayedMedications.length === 0 ? (
          <div className="p-6 text-center">
            <Pill size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-600">No medications scheduled</p>
          </div>
        ) : (
          <>
            {displayedMedications.map((medication) => (
              <div
                key={medication.id}
                className={`p-4 rounded-lg border transition-colors ${
                  medication.taken
                    ? 'bg-green-50 border-green-200'
                    : medication.remainingDoses <= 3
                    ? 'bg-orange-50 border-orange-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        medication.taken
                          ? 'bg-green-100'
                          : medication.remainingDoses <= 3
                          ? 'bg-orange-100'
                          : 'bg-purple-100'
                      }`}
                    >
                      {medication.taken ? (
                        <CheckCircle size={18} className="text-green-600" />
                      ) : medication.remainingDoses <= 3 ? (
                        <AlertTriangle size={18} className="text-orange-600" />
                      ) : (
                        <Pill size={18} className="text-purple-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900">{medication.name}</p>
                        {medication.remainingDoses <= 3 && !medication.taken && (
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                            Low stock
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600">{medication.dosage}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {medication.nextDose}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {medication.frequency}
                        </span>
                      </div>
                      {medication.instructions && (
                        <p className="text-xs text-slate-500 mt-2 italic">
                          {medication.instructions}
                        </p>
                      )}
                    </div>
                  </div>
                  {!medication.taken && (
                    <Button
                      size="sm"
                      onClick={() => onMarkAsTaken(medication.id)}
                      className="flex-shrink-0"
                    >
                      <CheckCircle size={16} className="mr-1" />
                      Take
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {!showAll && upcomingMedications.length > 3 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAll(true)}
                className="w-full"
              >
                View all ({upcomingMedications.length})
                <ChevronRight size={16} className="ml-1" />
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
