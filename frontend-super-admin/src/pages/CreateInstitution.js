import React, { useState } from 'react';
import { Layout, Form, Input, Button, Card, Row, Col } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { createInstitution } from '../services/api';
import { Helmet } from 'react-helmet';
import { toast } from 'react-toastify';

const { Header, Content } = Layout;

const CreateInstitution = ({ isDarkMode, toggleTheme }) => {
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const [form] = Form.useForm();

    const onFinish = async (values) => {
        setLoading(true);
        try {
            await createInstitution(values);
            toast.success('Institution created successfully!');
            navigate('/');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Helmet>
                <title>Create Institution - Super Admin</title>
            </Helmet>
            <Header style={{ padding: '0 16px', background: '#fff', display: 'flex', alignItems: 'center' }}>
                <Link to="/">
                    <Button type="text" icon={<ArrowLeftOutlined />}>Back</Button>
                </Link>
                <span style={{ marginLeft: 16, fontWeight: 'bold' }}>Create New Institution</span>
            </Header>
            <Content style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
                <Card>
                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={onFinish}
                        initialValues={{
                            dbName: 'inst_db_' + Math.floor(Math.random() * 10000)
                        }}
                    >
                        <Row gutter={16}>
                            <Col span={24}><h3>Basic Details</h3></Col>
                            <Col span={12}>
                                <Form.Item name="institutionName" label="Institution Name" rules={[{ required: true }]}>
                                    <Input placeholder="e.g. City Care Clinic" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="institutionCode" label="Unique Code" rules={[{ required: true }]}>
                                    <Input placeholder="e.g. CITY01" style={{ textTransform: 'uppercase' }} />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="subdomain" label="Subdomain" rules={[{ required: true }]}>
                                    <Input addonAfter=".site.com" placeholder="citycare" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="dbName" label="Database Name" rules={[{ required: true }]}>
                                    <Input placeholder="db_city_care" />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={16} style={{ marginTop: 24 }}>
                            <Col span={24}><h3>Administrator Account</h3></Col>
                            <Col span={12}>
                                <Form.Item name="adminName" label="Admin Full Name" rules={[{ required: true }]}>
                                    <Input placeholder="Dr. Smith" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="adminUsername" label="Admin Username" rules={[{ required: true }]}>
                                    <Input placeholder="admin_city" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="adminPassword" label="Admin Password" rules={[{ required: true }]}>
                                    <Input.Password />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Form.Item style={{ marginTop: 24 }}>
                            <Button type="primary" htmlType="submit" loading={loading} block size="large">
                                Create Institution & Initialize Database
                            </Button>
                        </Form.Item>
                    </Form>
                </Card>
            </Content>
        </Layout>
    );
};

export default CreateInstitution;
