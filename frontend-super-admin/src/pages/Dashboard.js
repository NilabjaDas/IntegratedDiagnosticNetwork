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
import { Modal } from 'antd';
import { getInstitutions, deleteInstitution, deactivateInstitution } from '../services/api';
import EditInstitutionWizard from './EditInstitutionWizard';
import CreateUserModal from './CreateUserModal';
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
    const [isWizardVisible, setIsWizardVisible] = useState(false);
    const [isUserModalVisible, setIsUserModalVisible] = useState(false);
    const [selectedInstitution, setSelectedInstitution] = useState(null);

    const showDeactivateConfirm = (institution) => {
        Modal.confirm({
            title: `Are you sure you want to ${institution.status ? 'deactivate' : 'activate'} this institution?`,
            content: `This will ${institution.status ? 'disable' : 'enable'} access for all users of this institution.`,
            okText: institution.status ? 'Deactivate' : 'Activate',
            okType: 'danger',
            cancelText: 'Cancel',
            async onOk() {
                try {
                    await deactivateInstitution(institution.institutionId, !institution.status);
                    toast.success(`Institution ${institution.status ? 'deactivated' : 'activated'} successfully`);
                    loadData();
                } catch (error) {
                    toast.error("Failed to update status");
                }
            },
        });
    };

    const handleDelete = (institution) => {
        Modal.confirm({
            title: 'Are you sure you want to delete this institution?',
            content: 'This action is permanent and cannot be undone. This will delete all data associated with this institution.',
            okText: 'Delete',
            okType: 'danger',
            cancelText: 'Cancel',
            onOk() {
                Modal.confirm({
                    title: 'Final Confirmation',
                    content: 'This is your final confirmation. Are you absolutely sure you want to delete this institution?',
                    okText: 'Yes, Delete',
                    okType: 'danger',
                    cancelText: 'Cancel',
                    async onOk() {
                        try {
                            await deleteInstitution(institution.institutionId);
                            toast.success("Institution deleted successfully");
                            loadData();
                        } catch (error) {
                            toast.error("Failed to delete institution");
                        }
                    },
                });
            },
        });
    };
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
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Space size="middle">
                    <Button onClick={() => {
                        setSelectedInstitution(record);
                        setIsUserModalVisible(true);
                    }}>Create User</Button>
                    <Button danger onClick={() => showDeactivateConfirm(record)}>
                        {record.status ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button danger onClick={() => handleDelete(record)}>Delete</Button>
                </Space>
            ),
        },
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
                            onRow={(record) => ({
                                onClick: () => {
                                    setSelectedInstitution(record);
                                    setIsWizardVisible(true);
                                },
                            })}
                        />
                    </div>
                </Content>
            </Layout>
            <EditInstitutionWizard
                open={isWizardVisible}
                onCancel={() => setIsWizardVisible(false)}
                onOk={() => {
                    setIsWizardVisible(false);
                    loadData();
                }}
                institution={selectedInstitution}
            />
            <CreateUserModal
                open={isUserModalVisible}
                onCancel={() => setIsUserModalVisible(false)}
                onOk={() => {
                    setIsUserModalVisible(false);
                }}
                institutionId={selectedInstitution?.institutionId}
            />
        </Layout>
    );
};

export default Dashboard;
