import React, { useEffect, useState } from 'react';
import { 
    Form, Input, InputNumber, Drawer, DatePicker, TimePicker, 
    message, Alert, Table, Button, Space, Popconfirm, Typography, Row, Col, Card, Tag 
} from 'antd';
import { 
    EditOutlined, DeleteOutlined, CloseOutlined, CalendarOutlined, ClockCircleOutlined, 
    StopOutlined, CheckCircleOutlined 
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { 
    createSpecialShift, updateSpecialShift, deleteSpecialShift, 
    addDoctorOverride, revokeDoctorAbsence 
} from '../../redux/apiCalls';

const { Text, Title } = Typography;

const DoctorSpecialShiftDrawer = ({ visible, onCancel, onSuccess, doctor }) => {
    const [form] = Form.useForm();
    const [editingShiftId, setEditingShiftId] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible) {
            handleResetForm();
        }
    }, [visible, form]);

    const handleResetForm = () => {
        form.resetFields();
        setEditingShiftId(null);
        form.setFieldsValue({
            date: dayjs(),
            shiftName: "Special Shift",
            maxTokens: 10
        });
    };

    const handleSave = async (values) => {
        setLoading(true);
        try {
            const formattedValues = {
                ...values,
                date: values.date.format("YYYY-MM-DD"),
                startTime: values.timeRange[0].format("HH:mm"),
                endTime: values.timeRange[1].format("HH:mm"),
            };
            
            if (editingShiftId) {
                await updateSpecialShift(doctor._id, editingShiftId, formattedValues);
                message.success(`Special Shift updated for Dr. ${doctor.personalInfo.lastName}`);
            } else {
                await createSpecialShift(doctor._id, formattedValues);
                message.success(`Special Shift added for Dr. ${doctor.personalInfo.lastName}`);
            }
            
            handleResetForm();
            onSuccess(); // Triggers a table refresh in the parent
        } catch (error) {
            message.error(error.response?.data?.message || "Failed to save special shift.");
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (record) => {
        setEditingShiftId(record._id);
        form.setFieldsValue({
            date: dayjs(record.date),
            shiftName: record.shiftName,
            timeRange: [dayjs(record.startTime, 'HH:mm'), dayjs(record.endTime, 'HH:mm')],
            maxTokens: record.maxTokens,
            note: record.note
        });
    };

    const handleDelete = async (shiftId) => {
        try {
            await deleteSpecialShift(doctor._id, shiftId);
            message.success("Special shift deleted.");
            if (editingShiftId === shiftId) handleResetForm();
            onSuccess();
        } catch (error) {
            message.error("Failed to delete shift.");
        }
    };

 // --- STATUS UPDATERS ---
    const handleCancelShift = async (record) => {
        try {
            await updateSpecialShift(doctor._id, record._id, { status: 'Cancelled' }); // <-- Updated payload
            message.success("Shift marked as Cancelled.");
            onSuccess();
        } catch (error) {
            message.error("Failed to cancel shift.");
        }
    };

    const handleRestoreShift = async (record) => {
        try {
            await updateSpecialShift(doctor._id, record._id, { status: 'Scheduled' }); // <-- Updated payload
            message.success("Shift restored successfully.");
            onSuccess();
        } catch (error) {
            message.error("Failed to restore shift.");
        }
    };

    // Filter to only show shifts from TODAY onwards
    const upcomingShifts = doctor?.specialShifts
        ?.filter(s => s.date >= dayjs().format('YYYY-MM-DD'))
        .sort((a, b) => new Date(a.date) - new Date(b.date)) || [];

    const columns = [
        { 
            title: 'Date', 
            dataIndex: 'date', 
            key: 'date', 
            render: text => (
                <Space>
                    <CalendarOutlined style={{ color: '#1890ff' }} />
                    <Text strong>{dayjs(text).format('DD MMM YYYY')}</Text>
                </Space>
            ) 
        },
        { 
            title: 'Shift Details', 
            key: 'shiftDetails', 
            render: (_, r) => (
                <div>
                    <Tag color="purple" style={{ marginBottom: 4 }}>{r.shiftName}</Tag>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                        <ClockCircleOutlined style={{ marginRight: 4 }}/> 
                        {r.startTime} - {r.endTime}
                    </div>
                </div>
            )
        },
        { 
            title: 'Capacity', 
            dataIndex: 'maxTokens', 
            key: 'maxTokens',
            render: val => <Tag color="blue">{val} Pts</Tag>
        },
        { 
            title: 'Status', 
            key: 'status',
            render: (_, r) => {
                // Determine display based on string status
                if (r.status === 'Cancelled') return <Tag color="red">Cancelled</Tag>;
                if (r.date < dayjs().format('YYYY-MM-DD')) return <Tag color="default">Passed</Tag>;
                return <Tag color="green">Scheduled</Tag>;
            }
        },
        { 
            title: 'Action', 
            key: 'action', 
            align: 'right',
            render: (_, record) => {
                const isCancelled = record.status === 'Cancelled';

                return (
                    <Space>
                        {!isCancelled && (
                            <Button type="primary" ghost size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>Edit</Button>
                        )}
                        
                        {isCancelled ? (
                            <Popconfirm title="Restore this cancelled shift?" onConfirm={() => handleRestoreShift(record)}>
                                <Button type="dashed" size="small" icon={<CheckCircleOutlined />} style={{ color: '#52c41a', borderColor: '#52c41a' }}>Restore</Button>
                            </Popconfirm>
                        ) : (
                            <Popconfirm title="Mark this shift as cancelled? (Patients won't be able to book)" onConfirm={() => handleCancelShift(record)}>
                                <Button type="dashed" danger size="small" icon={<StopOutlined />}>Cancel Shift</Button>
                            </Popconfirm>
                        )}

                        <Popconfirm title="Permanently delete this special shift from the database?" onConfirm={() => handleDelete(record._id)}>
                            <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                        </Popconfirm>
                    </Space>
                );
            } 
        }
    ];

    return (
        <Drawer
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Title level={4} style={{ margin: 0 }}>Special Shift Management</Title>
                    <Tag color="cyan" style={{ fontSize: 14 }}>Dr. {doctor?.personalInfo?.firstName} {doctor?.personalInfo?.lastName}</Tag>
                </div>
            }
            open={visible}
            onClose={() => {
                handleResetForm();
                onCancel();
            }}
            width="100%"
            destroyOnClose
            bodyStyle={{ background: '#f0f2f5', padding: '24px' }}
        >
            <Alert 
                message="About Ad-Hoc / Special Shifts" 
                description="Use this module to open up extra booking slots for a single day (e.g., clearing a backlog, Sunday emergency clinic, or VIP hours). You can temporarily cancel an active shift if the doctor becomes unavailable." 
                type="info" 
                showIcon 
                style={{ marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderRadius: 8 }}
            />

            <Row gutter={24}>
                {/* LEFT COLUMN: FORM */}
                <Col xs={24} lg={8}>
                    <Card 
                        title={
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{editingShiftId ? "Edit Existing Shift" : "Create New Shift"}</span>
                                {editingShiftId && (
                                    <Button type="dashed" size="small" danger icon={<CloseOutlined />} onClick={handleResetForm}>
                                        Cancel Edit
                                    </Button>
                                )}
                            </div>
                        }
                        style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderTop: editingShiftId ? '3px solid #1890ff' : '3px solid #52c41a' }}
                    >
                        <Form form={form} layout="vertical" onFinish={handleSave}>
                            <Form.Item name="date" label="Shift Date" rules={[{ required: true }]}>
                                <DatePicker size="large" style={{ width: '100%' }} disabledDate={current => current && current < dayjs().startOf('day')} />
                            </Form.Item>
                            
                            <Form.Item name="shiftName" label="Shift Name" rules={[{ required: true }]}>
                                <Input size="large" placeholder="e.g. VIP Consultation, Emergency Overtime" />
                            </Form.Item>
                            
                            <Row gutter={16}>
                                <Col span={14}>
                                    <Form.Item name="timeRange" label="Time Range" rules={[{ required: true }]}>
                                        <TimePicker.RangePicker size="large" format="HH:mm" style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                                <Col span={10}>
                                    <Form.Item name="maxTokens" label="Max Patients" rules={[{ required: true }]}>
                                        <InputNumber size="large" min={1} style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Form.Item name="note" label="Internal Notes (Optional)">
                                <Input.TextArea rows={3} placeholder="Reason for special shift, specific instructions for reception..." />
                            </Form.Item>

                            <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                                {editingShiftId ? "Save Changes" : "Create Special Shift"}
                            </Button>
                        </Form>
                    </Card>
                </Col>

                {/* RIGHT COLUMN: LEDGER TABLE */}
                <Col xs={24} lg={16}>
                    <Card 
                        title="Upcoming Special Shifts Ledger" 
                        style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', height: '100%' }}
                        bodyStyle={{ padding: 0 }}
                    >
                        <Table 
                            dataSource={upcomingShifts} 
                            columns={columns} 
                            rowKey="_id" 
                            pagination={{ pageSize: 8 }} 
                            locale={{ emptyText: "No upcoming special shifts scheduled." }}
                        />
                    </Card>
                </Col>
            </Row>
        </Drawer>
    );
};

export default DoctorSpecialShiftDrawer; 