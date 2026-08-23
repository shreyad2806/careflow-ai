import React from 'react';
import Card, { CardHeader, CardTitle, CardContent } from './ui/Card';
import { Zap, Shield, Clock, Users, BarChart, MessageSquare } from 'lucide-react';

export default function Features() {
  const features = [
    {
      icon: <Zap size={28} />,
      title: "Lightning-Fast Intake",
      description: "Reduce patient intake time by 70% with AI-powered voice recognition and automated form filling."
    },
    {
      icon: <Shield size={28} />,
      title: "Enterprise Security",
      description: "Bank-grade encryption with HIPAA compliance and SOC 2 Type II certification for complete data protection."
    },
    {
      icon: <Clock size={28} />,
      title: "24/7 Availability",
      description: "Round-the-clock AI assistance ensures patients always have access to care guidance and support."
    },
    {
      icon: <Users size={28} />,
      title: "Multi-Role Access",
      description: "Seamless workflows for patients, doctors, and administrators with role-specific dashboards."
    },
    {
      icon: <BarChart size={28} />,
      title: "Analytics Dashboard",
      description: "Real-time insights into patient flow, wait times, and operational efficiency metrics."
    },
    {
      icon: <MessageSquare size={28} />,
      title: "Natural Communication",
      description: "Conversational AI that understands medical terminology and patient language naturally."
    }
  ];

  return (
    <section id="features" className="py-20 px-4 md:px-8 bg-slate-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            Powerful Features for Modern Healthcare
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Everything you need to transform your healthcare delivery experience
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-4">
                  {feature.icon}
                </div>
                <CardTitle>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
