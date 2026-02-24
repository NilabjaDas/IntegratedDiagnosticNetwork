import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Spin } from 'antd';
import { useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { userRequest } from '../requestMethods';
import dayjs from 'dayjs';

// Import Modular Components
import TvHeader from '../components/Tv Display/TvHeader';
import TvSingleDepartmentLayout from '../components/Tv Display/TvSingleDepartmentLayout';
import TvCombinedLayout from '../components/Tv Display/TvCombinedLayout';

const PageContainer = styled.div`
  min-height: 100vh;
  background-color: ${props => props.themeColor ? `${props.themeColor}15` : '#f4f6f8'};
  display: flex;
  flex-direction: column;
`;

const TvDisplayPage = () => {
    const { currentUser } = useSelector((state) => state[process.env.REACT_APP_ACCESS_TOKEN_KEY]);
    const { department } = useParams(); // URL Param: e.g. "Pathology" or "combined"
    
    const [brandDetails, setBrandDetails] = useState(null);
    const [loadingSettings, setLoadingSettings] = useState(true);

    const [calledTokens, setCalledTokens] = useState([]);
    const [waitingTokens, setWaitingTokens] = useState([]);
    const [flashingToken, setFlashingToken] = useState(null);

    // 1. Fetch Branding
    useEffect(() => {
        const fetchBrand = async () => {
            try {
                const res = await userRequest.get('/institutions/my-settings');
                setBrandDetails(res.data.settings?.identity || {});
            } catch (error) {
                console.error("Failed to load branding");
            }
            setLoadingSettings(false);
        };
        fetchBrand();
    }, []);

    // 2. Fetch Filtered Queue
    const fetchLiveQueue = async () => {
        try {
            const todayStr = dayjs().format("YYYY-MM-DD");
            let endpoint = `/queue-manager?date=${todayStr}`;
            
            // MAGIC: If the URL is NOT "combined", filter strictly by the URL parameter!
            if (department && department.toLowerCase() !== 'combined') {
                endpoint += `&department=${department}`;
            }

            const res = await userRequest.get(endpoint);
            const allTokens = res.data;
            
            setCalledTokens(allTokens.filter(t => t.status === 'CALLED' || t.status === 'IN_PROGRESS').reverse());
            setWaitingTokens(allTokens.filter(t => t.status === 'WAITING'));
        } catch (error) {
            console.error("Failed to fetch queue");
        }
    };

    useEffect(() => {
        fetchLiveQueue();
        const interval = setInterval(fetchLiveQueue, 30000); // Auto-poll every 30s as backup
        return () => clearInterval(interval);
    }, [department]);

    // 3. SSE WebSockets for Instant Flashing
    useEffect(() => {
        if (!currentUser) return;

        const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";
        const url = `${BASE_URL}/webhooks/sse?channel=tv_display&brandCode=${currentUser.institutionId}`;
        
        const eventSource = new EventSource(url);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'TV_ANNOUNCEMENT') {
                    setFlashingToken(data.token);
                    
                    const audio = new Audio('/ding.mp3'); 
                    audio.play().catch(e => console.log("Audio play blocked by browser"));

                    fetchLiveQueue(); // Get fresh data immediately
                    setTimeout(() => setFlashingToken(null), 3000);
                }
            } catch (error) {
                console.error("SSE Parse Error:", error);
            }
        };

        return () => eventSource.close();
    }, [currentUser, department]);

    if (loadingSettings) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

    const primaryColor = brandDetails?.primaryColor || '#1890ff';
    const isCombined = department && department.toLowerCase() === 'combined';

    return (
        <PageContainer themeColor={primaryColor}>
            <TvHeader brandDetails={brandDetails} themeColor={primaryColor} department={department} />
            
            {/* RENDER THE CORRECT LAYOUT BASED ON URL */}
            {isCombined ? (
                <TvCombinedLayout 
                    calledTokens={calledTokens} 
                    waitingTokens={waitingTokens} 
                    themeColor={primaryColor} 
                />
            ) : (
                <TvSingleDepartmentLayout 
                    calledTokens={calledTokens} 
                    waitingTokens={waitingTokens} 
                    flashingToken={flashingToken}
                    themeColor={primaryColor} 
                />
            )}
        </PageContainer>
    );
};

export default TvDisplayPage;