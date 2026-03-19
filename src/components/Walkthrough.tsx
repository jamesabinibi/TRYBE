import React, { useState, useEffect } from 'react';
import Joyride, { Step } from 'react-joyride';

const steps: Step[] = [
  {
    target: 'nav',
    content: 'Welcome to Gryndee! This is your main navigation menu where you can access all features.',
    disableBeacon: true,
    placement: 'right',
  },
  {
    target: 'header',
    content: 'Use the global search to quickly find products, or click the + button to create new transactions.',
    placement: 'bottom',
  },
  {
    target: '.main-content',
    content: 'This is your main workspace. Here you will see your dashboard, manage inventory, and view reports.',
    placement: 'center',
  },
  {
    target: 'a[href="/sales"]',
    content: 'Record new sales and manage your transaction history here.',
    placement: 'right',
  },
  {
    target: 'a[href="/products"]',
    content: 'Add and manage your products, track inventory, and set low stock alerts.',
    placement: 'right',
  },
  {
    target: 'a[href="/settings"]',
    content: 'Customize your business profile, configure email templates, and manage staff accounts.',
    placement: 'right',
  }
];

const Walkthrough = () => {
  const [run, setRun] = useState(false);

  useEffect(() => {
    const hasSeenWalkthrough = localStorage.getItem('hasSeenWalkthrough');
    if (!hasSeenWalkthrough) {
      // Small delay to ensure elements are rendered
      setTimeout(() => setRun(true), 1000);
    }
  }, []);

  const handleJoyrideCallback = (data: any) => {
    const { status } = data;
    if (status === 'finished' || status === 'skipped') {
      localStorage.setItem('hasSeenWalkthrough', 'true');
      setRun(false);
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showSkipButton
      showProgress
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: '#10b981',
          zIndex: 10000,
        },
        tooltipContainer: {
          textAlign: 'left'
        },
        buttonNext: {
          backgroundColor: '#10b981',
          borderRadius: '8px',
          padding: '8px 16px',
          fontWeight: 'bold',
        },
        buttonBack: {
          marginRight: 10,
          color: '#6b7280'
        },
        buttonSkip: {
          color: '#6b7280'
        }
      }}
    />
  );
};

export default Walkthrough;
