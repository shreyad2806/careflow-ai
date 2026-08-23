import React from 'react';
import { BrainCircuit, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { SymptomAnalysis } from '@/lib/types';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

interface AIInsightCardProps {
  analysis: SymptomAnalysis;
}

export default function AIInsightCard({ analysis }: AIInsightCardProps) {
  const getUrgencyIcon = () => {
    switch (analysis.urgency) {
      case 'low': return CheckCircle;
      case 'medium': return Info;
      case 'high': return AlertTriangle;
      case 'critical': return AlertTriangle;
    }
  };

  const getUrgencyColor = () => {
    switch (analysis.urgency) {
      case 'low': return 'text-green-600 bg-green-50';
      case 'medium': return 'text-blue-600 bg-blue-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'critical': return 'text-red-600 bg-red-50';
    }
  };

  const UrgencyIcon = getUrgencyIcon();

  return (
    <Card className="border-blue-200">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <BrainCircuit className="text-blue-600" size={24} />
          </div>
          <div>
            <CardTitle>AI Symptom Analysis</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Analyzed on {new Date(analysis.analyzedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className={`flex items-center gap-2 p-3 rounded-lg ${getUrgencyColor()}`}>
          <UrgencyIcon size={20} />
          <span className="font-medium capitalize">{analysis.urgency} Urgency</span>
        </div>

        <div>
          <h4 className="font-semibold text-slate-900 mb-3">Reported Symptoms</h4>
          <div className="space-y-2">
            {analysis.symptoms.map((symptom) => (
              <div key={symptom.id} className="p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-slate-900">{symptom.name}</span>
                  <span className="text-xs capitalize px-2 py-1 bg-white rounded-full">
                    {symptom.severity}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{symptom.description}</p>
                <p className="text-xs text-slate-500 mt-1">Duration: {symptom.duration}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-semibold text-slate-900 mb-2">Possible Conditions</h4>
          <div className="flex flex-wrap gap-2">
            {analysis.possibleConditions.map((condition) => (
              <span key={condition} className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm">
                {condition}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-semibold text-slate-900 mb-2">Recommended Specialist</h4>
          <p className="text-blue-600 font-medium">{analysis.recommendedSpecialist}</p>
        </div>

        <div>
          <h4 className="font-semibold text-slate-900 mb-2">Recommendations</h4>
          <ul className="space-y-2">
            {analysis.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-slate-600">
                <span className="text-blue-500 mt-0.5">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-800">{analysis.disclaimer}</p>
        </div>
      </CardContent>
    </Card>
  );
}
