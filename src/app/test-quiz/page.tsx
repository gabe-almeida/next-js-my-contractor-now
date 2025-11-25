'use client';

import React from 'react';
import ServiceLocationQuiz from '@/components/contractor-signup/ServiceLocationQuiz';

export default function TestQuizPage() {
  const handleComplete = (data: any) => {
    console.log('Quiz completed with data:', data);
    alert('Quiz completed! Check the console for data.');
  };

  const handleStepSave = (stepId: string, data: any) => {
    console.log('Step saved:', stepId, data);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8">
          Service Location Quiz Test
        </h1>
        <ServiceLocationQuiz
          onComplete={handleComplete}
          onStepSave={handleStepSave}
        />
      </div>
    </div>
  );
}