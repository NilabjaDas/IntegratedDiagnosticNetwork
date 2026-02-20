// frontend-provider/src/pages/QueueManager/TvDisplayPage.jsx
import React, { useEffect, useState } from 'react';
import styled, { keyframes, css } from 'styled-components'; // <-- ADD 'css' HERE
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';

// A simple animation to flash the background when a new patient is called
const flash = keyframes`
  0% { background-color: #f0f2f5; }
  50% { background-color: #d9f7be; }
  100% { background-color: #f0f2f5; }
`;

const TvContainer = styled.div`
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f0f2f5;
  color: #000;
  overflow: hidden;
  
  /* USE THE 'css' TAG HERE */
  ${({ $flash }) => $flash && css`
      animation: ${flash} 2s ease-in-out;
  `}
`;

const Header = styled.div`
  background-color: #001529;
  color: white;
  padding: 20px 40px;
  font-size: 3rem;
  font-weight: bold;
  text-align: center;
`;

const MainContent = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
`;

const CurrentlyServingLabel = styled.div`
  font-size: 3rem;
  color: #595959;
`;

const TokenDisplay = styled.div`
  font-size: 15rem;
  font-weight: 900;
  color: #1890ff;
  line-height: 1;
  text-shadow: 4px 4px 10px rgba(0,0,0,0.1);
`;

const TvDisplayPage = () => {
    const { department } = useParams();
    const queue = useSelector((state) => state[process.env.REACT_APP_QUEUE_DATA_KEY]?.queue || []);
    
    const [currentlyServing, setCurrentlyServing] = useState(null);
    const [isFlashing, setIsFlashing] = useState(false);

    // Audio context for the "Chime" sound
    const playChime = () => {
        try {
            // Using a free chime sound URL or local asset
            const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
            audio.play();
        } catch (e) {
            console.log("Audio play blocked by browser. User must click first.");
        }
    };

    useEffect(() => {
        // Find the most recently "CALLED" token
        const calledTokens = queue.filter(q => q.status === 'CALLED');
        
        if (calledTokens.length > 0) {
            const latest = calledTokens[0];
            
            if (!currentlyServing || currentlyServing.tokenNumber !== latest.tokenNumber) {
                setCurrentlyServing(latest);
                setIsFlashing(true);
                playChime();
                setTimeout(() => setIsFlashing(false), 2000);
            }
        } else {
            // If no one is called, maybe show the one IN_PROGRESS
            const inProgress = queue.find(q => q.status === 'IN_PROGRESS');
            setCurrentlyServing(inProgress || null);
        }
    }, [queue]); // Removed `currentlyServing` from dependency array to prevent infinite loop

    return (
        <TvContainer $flash={isFlashing}>
            <Header>{department} Department</Header>
            <MainContent>
                <CurrentlyServingLabel>Currently Serving</CurrentlyServingLabel>
                <TokenDisplay>
                    {currentlyServing ? currentlyServing.tokenNumber : '---'}
                </TokenDisplay>
                {currentlyServing && (
                     <div style={{ fontSize: '2rem', marginTop: '20px', color: '#8c8c8c' }}>
                        Patient: {currentlyServing.patientDetails?.name || ''}
                     </div>
                )}
            </MainContent>
        </TvContainer>
    );
};

export default TvDisplayPage;