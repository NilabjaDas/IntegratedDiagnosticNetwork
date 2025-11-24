import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Alert } from 'antd';
import { UserOutlined, LockOutlined, ShopOutlined } from '@ant-design/icons';
import { login } from '../services/api';
import styled from 'styled-components';

const { Title } = Typography;

const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: #f0f2f5;
  flex-direction: column;
`;

const Login = ({ onLogin }) => {
    const [loading, setLoading] = useState(false);

    // For Dev Testing Only
    const [devCode, setDevCode] = useState(localStorage.getItem('dev_institution_code') || '');

    const onFinish = async (values) => {
        // Save dev code if provided
        if (devCode) localStorage.setItem('dev_institution_code', devCode);
        else localStorage.removeItem('dev_institution_code');

        setLoading(true);
        try {
            const data = await login(values.username, values.password);
            message.success('Login successful');
            onLogin(data.token);
        } catch (err) {
            message.error(err.response?.data?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container>
            <Card style={{ width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <Title level={3}>Provider Portal</Title>
                    <p>Access your clinic's dashboard</p>
                </div>

                <Alert
                    message="Developer Mode"
                    description={
                        <Input
                            prefix={<ShopOutlined />}
                            placeholder="Enter Institution Code (e.g. CITY01)"
                            value={devCode}
                            onChange={(e) => setDevCode(e.target.value)}
                            style={{ marginTop: 8 }}
                        />
                    }
                    type="info"
                    showIcon
                    style={{ marginBottom: 24 }}
                />

                <Form
                    name="login_form"
                    onFinish={onFinish}
                >
                    <Form.Item
                        name="username"
                        rules={[{ required: true, message: 'Please input your Username!' }]}
                    >
                        <Input prefix={<UserOutlined />} placeholder="Username" size="large" />
                    </Form.Item>
                    <Form.Item
                        name="password"
                        rules={[{ required: true, message: 'Please input your Password!' }]}
                    >
                        <Input.Password prefix={<LockOutlined />} placeholder="Password" size="large" />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                            Log in
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </Container>
    );
};

export default Login;
