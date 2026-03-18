import React, { useState, useEffect } from 'react';
import Joyride, { Step } from 'react-joyride';

const steps: Step[] = [
  {
    target: 'nav',
    content: 'Welcome! This is your main navigation menu.',
    disableBeacon: true,
  },
  {
    target: 'header',
    content: 'You can search for products and create new transactions here.',
  },
  {
    target: '.main-content',
    content: 'This is where your main dashboard and reports will appear.',
  },
];

const Walkthrough = () => {
  const [run, setRun] = useState(false);

  useEffect(() => {
    const hasSeenWalkthrough = localStorage.getItem('hasSeenWalkthrough');
    if (!hasSeenWalkthrough) {
      setRun(true);
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
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: '#10b981',
        },
      }}
    />
  );
};

export default Walkthrough;
