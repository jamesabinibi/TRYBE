import React, { useState, useEffect } from 'react';
import Joyride, { Step } from 'react-joyride';

const steps: Step[] = [
  {
    target: 'body',
    content: 'Welcome to your Inventory Management System! Let us show you around.',
    placement: 'center',
  },
  {
    target: '#sidebar-nav',
    content: 'This is your main navigation menu. You can access all sections of the app from here.',
    placement: 'right',
  },
  {
    target: '#nav-dashboard',
    content: 'View your business overview and key performance indicators here.',
    placement: 'right',
  },
  {
    target: '#nav-inventory',
    content: 'Manage your products, stock levels, and categories in the inventory section.',
    placement: 'right',
  },
  {
    target: '#nav-sales',
    content: 'Track your sales transactions and revenue performance.',
    placement: 'right',
  },
  {
    target: '#main-header',
    content: 'Use the header to switch between light and dark modes, and manage your profile.',
    placement: 'bottom',
  },
  {
    target: '#main-content-area',
    content: 'This is where your data and tools will be displayed.',
    placement: 'top',
  },
];

const Walkthrough = () => {
  const [run, setRun] = useState(false);

  useEffect(() => {
    const hasSeenWalkthrough = localStorage.getItem('hasSeenWalkthrough');
    if (!hasSeenWalkthrough) {
      // Increased delay to ensure all elements are rendered
      const timer = setTimeout(() => setRun(true), 2000);
      return () => clearTimeout(timer);
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
          primaryColor: '#ff4d00',
          zIndex: 10000,
        },
        tooltipContainer: {
          textAlign: 'left'
        },
        buttonNext: {
          backgroundColor: '#ff4d00',
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
