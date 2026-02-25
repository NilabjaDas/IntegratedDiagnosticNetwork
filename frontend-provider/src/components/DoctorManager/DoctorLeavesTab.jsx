import React, { useState, useMemo } from 'react';
import { Card, Table, Button, Form, Input, DatePicker, message, Row, Col, Statistic, Tag, Modal, Checkbox, Divider, Timeline, Radio, Select } from 'antd';
import { DeleteOutlined, CalendarOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { addDoctorLeave, revokeDoctorLeave } from '../../redux/apiCalls';

const { RangePicker } = DatePicker;
const { Option } = Select;

const DoctorLeavesTab = ({ doctor, refreshData }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    
    // Revoke Modal State
    const [revokeModalVisible, setRevokeModalVisible] = useState(false);
    const [selectedLeave, setSelectedLeave] = useState(null);
    const [selectedDatesToRevoke, setSelectedDatesToRevoke] = useState([]);

    // Watchers for dynamic form rendering
    const leaveType = Form.useWatch('leaveType', form);
    const dateRange = Form.useWatch('dateRange', form);

    // --- 1. SMART DATE PICKER VALIDATOR ---
    const disabledDate = (current) => {
        if (!current || current < dayjs().startOf('day')) return true;

        const dateStr = current.format('YYYY-MM-DD');
        const dayIndex = current.day();

        // Check if doctor actually works on this day
        const daySch = doctor?.schedule?.find(s => s.dayOfWeek === dayIndex);
        if (!daySch || !daySch.isAvailable || !daySch.shifts || daySch.shifts.length === 0) {
            return true; // Doctor doesn't work this day
        }

        // Check if there is already a FULL DAY leave booked for this date
        const hasFullDayLeave = doctor?.leaves?.some(l => {
            const isDateInRange = dateStr >= l.startDate && dateStr <= l.endDate;
            const isFullDay = !l.shiftNames || l.shiftNames.length === 0;
            return isDateInRange && isFullDay;
        });

        if (hasFullDayLeave) return true; // Block date

        return false;
    };

    // --- 2. SMART SHIFT PICKER VALIDATOR ---
    const availableShifts = useMemo(() => {
        if (!dateRange || !dateRange[0] || !dateRange[1] || !doctor?.schedule) return [];
        let curr = dateRange[0].startOf('day');
        const endDay = dateRange[1].startOf('day');
        
        const allShifts = new Set();
        const alreadyBookedShifts = new Set();

        // Loop through the selected date range
        while (curr.isBefore(endDay, 'day') || curr.isSame(endDay, 'day')) {
            const dateStr = curr.format('YYYY-MM-DD');
            const dayIndex = curr.day();
            
            // Collect all available shifts for these days
            const daySch = doctor.schedule.find(s => s.dayOfWeek === dayIndex);
            if (daySch && daySch.isAvailable) {
                daySch.shifts.forEach(s => allShifts.add(s.shiftName));
            }

            // Collect any shifts already booked for partial leave on these days
            const leavesOnDate = doctor.leaves?.filter(l => dateStr >= l.startDate && dateStr <= l.endDate) || [];
            leavesOnDate.forEach(l => {
                if (l.shiftNames && l.shiftNames.length > 0) {
                    l.shiftNames.forEach(shift => alreadyBookedShifts.add(shift));
                }
            });

            curr = curr.add(1, 'day');
        }

        // Return only shifts that are NOT already booked
        return Array.from(allShifts).filter(shift => !alreadyBookedShifts.has(shift));
    }, [dateRange, doctor]);

    if (!doctor) {
        return (
            <div style={{ textAlign: 'center', padding: 40 }}>
                <SafetyCertificateOutlined style={{ fontSize: 40, color: '#d9d9d9', marginBottom: 16 }} />
                <h3>Please save the doctor's profile first.</h3>
                <p>You can manage their leave ledger once the profile is created.</p>
            </div>
        );
    }

    const limit = doctor.leaveSettings?.leaveLimitPerYear || 20;
    const taken = doctor.metrics?.leavesTaken || 0;
    const remaining = limit - taken;

    const handleAddLeave = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const payload = {
                startDate: values.dateRange[0].format('YYYY-MM-DD'),
                endDate: values.dateRange[1].format('YYYY-MM-DD'),
                reason: values.reason,
                shiftNames: values.leaveType === 'PARTIAL' ? values.shiftNames : []
            };
            
            const updatedDoctor = await addDoctorLeave(doctor.doctorId, payload);
            message.success("Leave granted and ledger updated.");
            form.resetFields();
            refreshData(updatedDoctor); 
        } catch (error) {
            if (error.response) message.error(error.response?.data?.message || "Failed to add leave.");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenRevoke = (leave) => {
        setSelectedLeave(leave);
        setSelectedDatesToRevoke([]);
        setRevokeModalVisible(true);
    };

    // --- 3. REVOKE HANDLERS ---
    const submitPartialRevoke = async () => {
        if (selectedDatesToRevoke.length === 0) return message.warning("Select at least one date to revoke.");
        setLoading(true);
        try {
            const updatedDoctor = await revokeDoctorLeave(doctor.doctorId, selectedLeave._id, selectedDatesToRevoke);
            message.success("Selected dates revoked. Balance adjusted.");
            setRevokeModalVisible(false);
            refreshData(updatedDoctor);
        } catch (error) {
            message.error("Failed to revoke leave.");
        }
        setLoading(false);
    };

    const submitVoidEntireLeave = async () => {
        setLoading(true);
        try {
            const allDates = generateDateList(selectedLeave.startDate, selectedLeave.endDate);
            const updatedDoctor = await revokeDoctorLeave(doctor.doctorId, selectedLeave._id, allDates);
            message.success("Entire leave voided successfully.");
            setRevokeModalVisible(false);
            refreshData(updatedDoctor);
        } catch (error) {
            message.error("Failed to void entire leave.");
        }
        setLoading(false);
    };

    const generateDateList = (start, end) => {
        let dates = [];
        let curr = dayjs(start);
        const endD = dayjs(end);
        while (curr.isBefore(endD, 'day') || curr.isSame(endD, 'day')) {
            dates.push(curr.format('YYYY-MM-DD'));
            curr = curr.add(1, 'day');
        }
        return dates;
    };

    const columns = [
        { title: 'Date Range', key: 'dates', render: (_, r) => <b>{dayjs(r.startDate).format('DD MMM')} - {dayjs(r.endDate).format('DD MMM YYYY')}</b> },
        { title: 'Scope', key: 'scope', render: (_, r) => r.shiftNames?.length > 0 ? <Tag color="orange">Shifts: {r.shiftNames.join(', ')}</Tag> : <Tag color="red">Full Day(s)</Tag> },
        { title: 'Billed', dataIndex: 'leaveDaysCount', key: 'days', render: t => <Tag color="blue">{t} days</Tag> },
        { title: 'Reason', dataIndex: 'reason', key: 'reason' },
        { 
            title: 'Action', 
            key: 'action', 
            render: (_, record) => (
                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleOpenRevoke(record)}>Revoke</Button>
            ) 
        }
    ];

    return (
        <div>
            {/* STATS HEADER */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col span={8}><Card size="small" style={{ borderLeft: '4px solid #1890ff' }}><Statistic title="Annual Limit" value={limit} suffix="Days" /></Card></Col>
                <Col span={8}><Card size="small" style={{ borderLeft: '4px solid #cf1322' }}><Statistic title="Leaves Taken" value={taken} suffix="Days" valueStyle={{ color: '#cf1322' }} /></Card></Col>
                <Col span={8}><Card size="small" style={{ borderLeft: '4px solid #52c41a' }}><Statistic title="Balance Remaining" value={remaining} suffix="Days" valueStyle={{ color: '#52c41a' }} /></Card></Col>
            </Row>

            <Row gutter={24}>
                <Col span={14}>
                    <Card title="Active Planned Leaves" size="small">
                        <Table columns={columns} dataSource={doctor.leaves || []} rowKey="_id" pagination={false} size="small" locale={{ emptyText: "No active leaves." }} />
                    </Card>

                    <Card title="Apply New Leave" size="small" style={{ marginTop: 16 }}>
                        <Form form={form} layout="vertical" initialValues={{ leaveType: 'FULL_DAY' }}>
                            <Row gutter={16}>
                                <Col span={12}>
                                    {/* APPLIED DISABLED DATES HERE */}
                                    <Form.Item name="dateRange" label="Leave Duration" rules={[{ required: true }]}>
                                        <RangePicker style={{ width: '100%' }} disabledDate={disabledDate} />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="leaveType" label="Leave Scope">
                                        <Radio.Group onChange={(e) => { if (e.target.value === 'FULL_DAY') form.setFieldsValue({ shiftNames: [] }); }}>
                                            <Radio.Button value="FULL_DAY">Full Day(s)</Radio.Button>
                                            <Radio.Button value="PARTIAL" disabled={availableShifts.length === 0}>Specific Shift(s)</Radio.Button>
                                        </Radio.Group>
                                    </Form.Item>
                                </Col>
                            </Row>

                            {leaveType === 'PARTIAL' && (
                                <Form.Item name="shiftNames" label="Select Shifts to Cancel" rules={[{ required: true, message: 'Please select at least one shift.' }]}>
                                    <Select mode="multiple" placeholder="Select shifts (e.g. Morning OPD)">
                                        {availableShifts.map(s => <Option key={s} value={s}>{s}</Option>)}
                                    </Select>
                                </Form.Item>
                            )}

                            <Form.Item name="reason" label="Reason" rules={[{ required: true }]}>
                                <Input placeholder="e.g. Attending Medical Conference" />
                            </Form.Item>

                            <Button type="primary" htmlType="button" onClick={handleAddLeave} loading={loading} icon={<CalendarOutlined />}>
                                Grant & Deduct Balance
                            </Button>
                        </Form>
                    </Card>
                </Col>

                <Col span={10}>
                    <Card title="Audit Ledger" size="small" bodyStyle={{ maxHeight: 400, overflowY: 'auto' }}>
                        {doctor.leaveAuditLogs?.length === 0 ? <p style={{ color: '#888' }}>No ledger history.</p> : (
                            <Timeline>
                                {[...(doctor.leaveAuditLogs || [])].reverse().map((log, idx) => (
                                    <Timeline.Item key={idx} color={log.action === 'GRANTED' ? 'green' : 'red'}>
                                        <p style={{ margin: 0, fontWeight: 'bold' }}>{log.action} <span style={{ fontWeight: 'normal', color: '#888', fontSize: 12 }}>by {log.byUserName}</span></p>
                                        <p style={{ margin: 0, fontSize: 13 }}>{log.details}</p>
                                        <p style={{ margin: 0, fontSize: 12, color: '#bfbfbf' }}>{dayjs(log.timestamp).format('DD MMM YYYY, HH:mm')}</p>
                                    </Timeline.Item>
                                ))}
                            </Timeline>
                        )}
                    </Card>
                </Col>
            </Row>

            {/* REVOKE MODAL WITH NEW BUTTONS */}
            <Modal
                title="Revoke Leave"
                open={revokeModalVisible}
                onCancel={() => setRevokeModalVisible(false)}
                footer={[
                    <Button key="cancel" onClick={() => setRevokeModalVisible(false)}>
                        Cancel
                    </Button>,
                    <Button key="revokePartial" type="primary" ghost danger onClick={submitPartialRevoke} loading={loading} disabled={selectedDatesToRevoke.length === 0}>
                        Revoke Selected Dates
                    </Button>,
                    <Button key="revokeAll" type="primary" danger onClick={submitVoidEntireLeave} loading={loading}>
                        Void Entire Leave
                    </Button>
                ]}
            >
                <p>Select specific dates to cancel partially, or click <b>Void Entire Leave</b> to remove the block completely.</p>
                <Divider />
                {selectedLeave && (
                    <Checkbox.Group style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }} onChange={setSelectedDatesToRevoke} value={selectedDatesToRevoke}>
                        {generateDateList(selectedLeave.startDate, selectedLeave.endDate).map(d => (
                            <Checkbox key={d} value={d}>
                                <Tag>{dayjs(d).format('dddd')}</Tag> <b>{dayjs(d).format('DD MMM YYYY')}</b>
                            </Checkbox>
                        ))}
                    </Checkbox.Group>
                )}
            </Modal>
        </div>
    );
};

export default DoctorLeavesTab;