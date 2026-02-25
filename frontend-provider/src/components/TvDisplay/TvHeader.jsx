import React from 'react';
import styled from 'styled-components';
import { Typography } from 'antd';
import { SoundOutlined } from '@ant-design/icons';

const { Title } = Typography;

const HeaderWrapper = styled.div`
  background-color: ${props => props.themeColor || '#1890ff'};
  padding: 16px 32px;
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
`;

const TvHeader = ({ brandDetails, themeColor, department }) => {
    // Format the title nicely based on the URL
    let titleText = 'Global Queue Status';
    if (department && department.toLowerCase() !== 'combined') {
        titleText = `${department} Queue Status`;
    }

    return (
        <HeaderWrapper themeColor={themeColor}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {brandDetails?.logoUrl ? (
                    <img src={brandDetails.logoUrl} alt="Logo" style={{ height: 50, background: '#fff', padding: 4, borderRadius: 4 }} />
                ) : (
                    <Title level={3} style={{ color: 'white', margin: 0 }}>
                        {brandDetails?.institutionName || 'Integrated Diagnostics'}
                    </Title>
                )}
            </div>
            <Title level={2} style={{ color: 'white', margin: 0 }}>{titleText}</Title>
            <div style={{ fontSize: 24 }}><SoundOutlined /></div>
        </HeaderWrapper>
    );
};

export default TvHeader;