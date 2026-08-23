'use client';

import React, { useState } from 'react';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Pill, Clock, CheckCircle, AlertTriangle, Plus, Calendar, ChevronRight, X, ChevronDown } from 'lucide-react';

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

export const DEFAULT_MEDICATIONS: Medication[] = [
  {
    id: '1',
    name: 'Lisinopril',
    dosage: '10mg',
    frequency: 'Once daily',
    nextDose: '8:00 AM today',
    taken: false,
    instructions: 'Take in the morning with water. Avoid potassium supplements.',
    remainingDoses: 22,
  },
  {
    id: '2',
    name: 'Metformin',
    dosage: '500mg',
    frequency: 'Twice daily',
    nextDose: '12:00 PM today',
    taken: false,
    instructions: 'Take with meals to reduce stomach upset.',
    remainingDoses: 15,
  },
  {
    id: '3',
    name: 'Vitamin D3',
    dosage: '2000 IU',
    frequency: 'Once daily',
    nextDose: '8:00 AM today',
    taken: true,
    instructions: 'Take with fatty meal for better absorption.',
    remainingDoses: 28,
  },
  {
    id: '4',
    name: 'Omeprazole',
    dosage: '20mg',
    frequency: 'Once daily',
    nextDose: '7:00 AM tomorrow',
    taken: false,
    instructions: 'Take 30 minutes before breakfast on an empty stomach.',
    remainingDoses: 2,
  },
  {
    id: '5',
    name: 'Aspirin',
    dosage: '81mg',
    frequency: 'Once daily',
    nextDose: '8:00 AM today',
    taken: true,
    instructions: 'Low-dose aspirin for heart health.',
    remainingDoses: 18,
  },
];

interface MedicationReminderProps {
  medications?: Medication[];
  onMarkAsTaken?: (id: string) => void;
  onAddMedication?: (med: Omit<Medication, 'id' | 'taken' | 'remainingDoses'>) => void;
}

export default function MedicationReminder({
  medications: propMedications,
  onMarkAsTaken: propOnMarkAsTaken,
  onAddMedication: propOnAddMedication,
}: MedicationReminderProps) {
  const [medications, setMedications] = useState<Medication[]>(propMedications || DEFAULT_MEDICATIONS);
  const [showAll, setShowAll] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMed, setNewMed] = useState({ name: '', dosage: '', frequency: '', nextDose: '', instructions: '' });

  const onMarkAsTaken = (id: string) => {
    if (propOnMarkAsTaken) {
      propOnMarkAsTaken(id);
    } else {
      setMedications(prev =>
        prev.map(m => m.id === id ? { ...m, taken: true } : m)
      );
    }
  };

  const onAddMedication = () => {
    if (!newMed.name.trim()) return;
    const added: Medication = {
      id: String(Date.now()),
      name: newMed.name,
      dosage: newMed.dosage,
      frequency: newMed.frequency,
      nextDose: newMed.nextDose || 'Not scheduled',
      taken: false,
      instructions: newMed.instructions,
      remainingDoses: 30,
    };
    if (propOnAddMedication) {
      propOnAddMedication(newMed);
    } else {
      setMedications(prev => [...prev, added]);
    }
    setNewMed({ name: '', dosage: '', frequency: '', nextDose: '', instructions: '' });
    setShowAddModal(false);
  };

  const upcomingMedications = medications.filter(m => !m.taken);
  const displayedMedications = showAll ? medications : medications.slice(0, 4);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Pill size={20} className="text-purple-600" />
              Medication Reminders
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowAddModal(true)}>
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
                  className={`p-4 rounded-lg border transition-all ${
                    medication.taken
                      ? 'bg-green-50/80 border-green-200'
                      : medication.remainingDoses <= 3
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div
                        className={`p-2 rounded-lg flex-shrink-0 ${
                          medication.taken
                            ? 'bg-green-100'
                            : medication.remainingDoses <= 3
                            ? 'bg-amber-100'
                            : 'bg-purple-100'
                        }`}
                      >
                        {medication.taken ? (
                          <CheckCircle size={18} className="text-green-600" />
                        ) : medication.remainingDoses <= 3 ? (
                          <AlertTriangle size={18} className="text-amber-600" />
                        ) : (
                          <Pill size={18} className="text-purple-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`font-medium ${medication.taken ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                            {medication.name} {medication.dosage}
                          </p>
                          {medication.taken && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                              Taken
                            </span>
                          )}
                          {!medication.taken && medication.remainingDoses <= 3 && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                              Low stock ({medication.remainingDoses} left)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {medication.frequency}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {medication.taken ? 'Completed' : `Next: ${medication.nextDose}`}
                          </span>
                        </div>
                        {medication.instructions && (
                          <p className="text-xs text-slate-400 mt-1.5 italic">
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
                        <CheckCircle size={14} className="mr-1" />
                        Take
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {!showAll && medications.length > 4 && (
                <button
                  onClick={() => setShowAll(true)}
                  className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-1"
                >
                  View all ({medications.length})
                  <ChevronDown size={14} />
                </button>
              )}
              {showAll && medications.length > 4 && (
                <button
                  onClick={() => setShowAll(false)}
                  className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 font-medium"
                >
                  Show less
                </button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Add Medication Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6 z-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-900">Add Medication</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Medication Name *</label>
                <input
                  type="text"
                  value={newMed.name}
                  onChange={e => setNewMed(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="e.g., Ibuprofen"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dosage</label>
                  <input
                    type="text"
                    value={newMed.dosage}
                    onChange={e => setNewMed(prev => ({ ...prev, dosage: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="e.g., 200mg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Frequency</label>
                  <select
                    value={newMed.frequency}
                    onChange={e => setNewMed(prev => ({ ...prev, frequency: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">Select...</option>
                    <option value="Once daily">Once daily</option>
                    <option value="Twice daily">Twice daily</option>
                    <option value="Three times daily">Three times daily</option>
                    <option value="As needed">As needed</option>
                    <option value="Weekly">Weekly</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Instructions (optional)</label>
                <textarea
                  value={newMed.instructions}
                  onChange={e => setNewMed(prev => ({ ...prev, instructions: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="e.g., Take with food"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button onClick={onAddMedication} disabled={!newMed.name.trim()} className="flex-1">
                <Plus size={16} className="mr-1" />
                Add Medication
              </Button>
              <Button variant="outline" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

