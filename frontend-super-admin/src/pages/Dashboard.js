import React, { useEffect, useState } from 'react';
import { Layout, Menu, Table, Button, Switch, theme } from 'antd';
import {
    LogoutOutlined,
    PlusOutlined,
    BankOutlined,
    BulbOutlined,
    BulbFilled
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { getInstitutions } from '../services/api';
import { Helmet } from 'react-helmet';
import { toast } from 'react-toastify';
import styled from 'styled-components';

const { Header, Content, Sider } = Layout;

const StyledHeader = styled(Header)`
    padding: 0 16px;
    background: ${props => props.bg};
    display: flex;
    justify-content: space-between;
    align-items: center;
`;

const Dashboard = ({ isDarkMode, toggleTheme, onLogout }) => {
    const [institutions, setInstitutions] = useState([]);
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
            const data = await getInstitutions();
            setInstitutions(data);
        } catch (err) {
            toast.error("Failed to load institutions");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        { title: 'Name', dataIndex: 'institutionName', key: 'name' },
        { title: 'Code', dataIndex: 'institutionCode', key: 'code' },
        { title: 'Subdomain', dataIndex: 'primaryDomain', key: 'domain' },
        { title: 'DB Name', dataIndex: 'dbName', key: 'dbName' },
        { title: 'Status', dataIndex: 'status', key: 'status', render: (text) => text ? 'Active' : 'Inactive' },
    ];

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Helmet>
                <title>Dashboard - Super Admin</title>
                <meta name="description" content="Manage all healthcare institutions" />
            </Helmet>
            <Sider collapsible>
                <div style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)' }} />
                <Menu theme="dark" defaultSelectedKeys={['1']} mode="inline" items={[
                    { key: '1', icon: <BankOutlined />, label: 'Institutions' },
                ]} />
            </Sider>
            <Layout>
                <StyledHeader bg={colorBgContainer}>
                    <div style={{ fontWeight: 'bold', fontSize: '18px' }}>Super Admin Dashboard</div>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                         <Switch
                            checked={isDarkMode}
                            onChange={toggleTheme}
                            checkedChildren={<BulbFilled />}
                            unCheckedChildren={<BulbOutlined />}
                        />
                        <Button icon={<LogoutOutlined />} onClick={onLogout}>Logout</Button>
                    </div>
                </StyledHeader>
                <Content style={{ margin: '16px' }}>
                    <div
                        style={{
                            padding: 24,
                            minHeight: 360,
                            background: colorBgContainer,
                            borderRadius: borderRadiusLG,
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                            <h2>All Institutions</h2>
                            <Link to="/create-institution">
                                <Button type="primary" icon={<PlusOutlined />}>New Institution</Button>
                            </Link>
                        </div>
                        <Table
                            dataSource={institutions}
                            columns={columns}
                            rowKey="institutionId"
                            loading={loading}
                        />
                    </div>
                </Content>
            </Layout>
        </Layout>
    );
};

export default Dashboard;
