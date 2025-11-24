import React, { useEffect, useState } from 'react';
import { Layout, Menu, Table, Button, Switch, theme, Tag } from 'antd';
import {
    LogoutOutlined,
    MedicineBoxOutlined,
    BulbOutlined,
    BulbFilled
} from '@ant-design/icons';
import { getOrders } from '../services/api';

const { Header, Content, Sider } = Layout;

const Dashboard = ({ isDarkMode, toggleTheme, onLogout }) => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const {
        token: { colorBgContainer, borderRadiusLG },
    } = theme.useToken();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getOrders();
            setOrders(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        { title: 'ID', dataIndex: 'id', key: 'id' },
        { title: 'Patient', dataIndex: 'patient', key: 'patient' },
        { title: 'Test', dataIndex: 'test', key: 'test' },
        { title: 'Status', dataIndex: 'status', key: 'status', render: (status) => (
            <Tag color={status === 'Completed' ? 'green' : 'orange'}>{status}</Tag>
        ) },
    ];

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider collapsible>
                <div style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)' }} />
                <Menu theme="dark" defaultSelectedKeys={['1']} mode="inline" items={[
                    { key: '1', icon: <MedicineBoxOutlined />, label: 'Orders' },
                ]} />
            </Sider>
            <Layout>
                <Header style={{ padding: '0 16px', background: colorBgContainer, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '18px' }}>Clinic Dashboard</div>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                         <Switch
                            checked={isDarkMode}
                            onChange={toggleTheme}
                            checkedChildren={<BulbFilled />}
                            unCheckedChildren={<BulbOutlined />}
                        />
                        <Button icon={<LogoutOutlined />} onClick={onLogout}>Logout</Button>
                    </div>
                </Header>
                <Content style={{ margin: '16px' }}>
                    <div
                        style={{
                            padding: 24,
                            minHeight: 360,
                            background: colorBgContainer,
                            borderRadius: borderRadiusLG,
                        }}
                    >
                        <h2>Active Orders</h2>
                        <Table
                            dataSource={orders}
                            columns={columns}
                            rowKey="id"
                            loading={loading}
                        />
                    </div>
                </Content>
            </Layout>
        </Layout>
    );
};

export default Dashboard;
