import React from 'react';
import Card, { CardHeader, CardTitle, CardContent } from './ui/Card';
import { User, Stethoscope, Settings } from 'lucide-react';

export default function UserWorkflows() {
  const workflows = [
    {
      icon: <User size={32} />,
      title: "For Patients",
      description: "Seamless symptom reporting, appointment scheduling, and health tracking",
      features: [
        "Voice-powered symptom intake",
        "Real-time appointment updates",
        "Personalized health insights",
        "Secure messaging with providers"
      ]
    },
    {
      icon: <Stethoscope size={32} />,
      title: "For Doctors",
      description: "AI-assisted diagnostics, streamlined patient management, and efficient workflows",
      features: [
        "AI-prepared patient summaries",
        "Automated documentation",
        "Treatment plan suggestions",
        "Analytics and outcomes tracking"
      ]
    },
    {
      icon: <Settings size={32} />,
      title: "For Administrators",
      description: "Complete oversight, resource optimization, and operational intelligence",
      features: [
        "Real-time facility dashboards",
        "Staff and resource scheduling",
        "Compliance reporting",
        "Performance analytics"
      ]
    }
  ];

  return (
    <section className="py-20 px-4 md:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            Tailored Workflows for Every Role
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Purpose-built experiences that empower every stakeholder in the healthcare ecosystem
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {workflows.map((workflow, index) => (
            <Card key={index} className="hover:shadow-xl transition-shadow border-t-4 border-t-blue-500">
              <CardHeader>
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center text-white mb-4">
                  {workflow.icon}
                </div>
                <CardTitle className="text-2xl">{workflow.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 mb-6">{workflow.description}</p>
                <ul className="space-y-3">
                  {workflow.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-slate-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
