import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { adminLogin } from '../redux/apiCalls';
import styled from 'styled-components';
import { Helmet } from 'react-helmet';
import { toast } from 'react-toastify';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
const { Title } = Typography;

const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: #f0f2f5;
`;

const StyledCard = styled(Card)`
  width: 400px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
`;

const Login = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const token = useSelector(
        (state) => state[process.env.REACT_APP_ACCESS_TOKEN_KEY]?.token
    );

    useEffect(() => {
        if (token) {
            navigate('/', { replace: true });
        }
    }, [token, navigate]);

    const onFinish = async (values) => {
        setLoading(true);
        try {
            await adminLogin(dispatch, values.username, values.password);
            toast.success('Login successful');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container>
            <Helmet>
                <title>Login - Super Admin</title>
            </Helmet>
            <StyledCard>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <Title level={3}>Super Admin</Title>
                </div>
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
                    <div style={{ textAlign: 'center', color: '#888' }}>
                       Default: admin / admin
                    </div>
                </Form>
            </StyledCard>
        </Container>
    );
};

export default Login;