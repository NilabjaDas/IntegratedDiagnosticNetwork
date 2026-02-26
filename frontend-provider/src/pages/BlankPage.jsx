import React from 'react';
import { Card, Typography, Empty } from 'antd';

const { Title } = Typography;

const BlankPage = ({ title }) => {
    return (
        <div style={{ padding: 24, minHeight: '100vh', background: '#f4f6f8' }}>
            <Title level={3} style={{ margin: '0 0 24px 0' }}>{title}</Title>
            <Card style={{ minHeight: '65vh', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: 8 }}>
                <Empty description={<span style={{ color: '#888' }}>This module is currently blank and ready for future development.</span>} />
            </Card>
        </div>
    );
};

export default BlankPage;