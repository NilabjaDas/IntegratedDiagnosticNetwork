import React from 'react'
import styled, { keyframes } from 'styled-components';
import { StopOutlined } from '@ant-design/icons';
import { Typography } from 'antd';

const { Title, Text } = Typography;

// --- Animations ---
const popIn = keyframes`
  0% { opacity: 0; transform: scale(0.9); }
  100% { opacity: 1; transform: scale(1); }
`;

// --- Styled Components ---
const DeactivatedOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6); // Darkens the background
  backdrop-filter: blur(8px); // Blurs the content behind
  z-index: 9999;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const AlertCard = styled.div`
  background: #fff;
  padding: 40px;
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  text-align: center;
  max-width: 400px;
  width: 90%;
  border-top: 6px solid #ff4d4f; // Ant Design Red
  animation: ${popIn} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
`;

const IconWrapper = styled.div`
  background: #fff1f0;
  color: #ff4d4f;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 36px;
  margin: 0 auto 24px;
`;
const DeactivatedOverlayComp = ({institutionDetails}) => {
  return (
        <DeactivatedOverlay>
    <AlertCard>
      <IconWrapper>
        <StopOutlined />
      </IconWrapper>
      
      <Title level={3} style={{ marginBottom: 8, color: '#262626' }}>
        Access Restricted
      </Title>
      
      <Text style={{ fontSize: '16px', color: '#595959' }}>
        <b style={{ color: '#ff4d4f' }}>{institutionDetails.institutionName}</b> is currently deactivated.
      </Text>
      
      <div style={{ marginTop: 24 }}>
        <Text type="secondary" style={{ fontSize: '13px' }}>
          Please contact the platform administrator for assistance.
        </Text>
      </div>
    </AlertCard>
  </DeactivatedOverlay>
  )
}

export default DeactivatedOverlayComp
