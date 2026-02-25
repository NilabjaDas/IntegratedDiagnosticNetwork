import React, { useEffect } from 'react';
import { Form, Input, InputNumber, Row, Col, Typography, Modal, Switch, DatePicker, Select, Alert } from 'antd';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;

const DoctorOverrideModal = ({ visible, onCancel, onSave, doctor }) => {
    const [form] = Form.useForm();

    // Use useWatch to dynamically disable fields in real-time based on the switch state
    const isCancelled = Form.useWatch('isCancelled', form);

    // 1. Get today's day index
    const today = dayjs();
    const todayIndex = today.day(); 

    // 2. Find today's shifts
    const todaysSchedule = doctor?.schedule?.find(s => s.dayOfWeek === todayIndex);
    const todayShifts = todaysSchedule?.isAvailable ? todaysSchedule.shifts : [];

    // Reset and auto-fill the form whenever the modal opens
    useEffect(() => {
        if (visible) {
            form.resetFields();
            form.setFieldsValue({ 
                date: today,
                shiftNames: [],
                isCancelled: false,
                delayMinutes: 0
            });
        }
    }, [visible, form, doctor, todayShifts]);

    // --- STRICT FULL DAY CANCEL LOGIC ---
    const handleValuesChange = (changedValues) => {
        // We only care if they touched the switch
        if (changedValues.isCancelled !== undefined) {
            if (changedValues.isCancelled) {
                // Toggled ON: Auto-select all shifts and zero out delay
                const allShifts = todayShifts?.map(s => s.shiftName) || [];
                form.setFieldsValue({ 
                    shiftNames: allShifts, 
                    delayMinutes: 0 
                });
            } else {
                // Toggled OFF: Clear shifts so user can manually pick them for delays
                form.setFieldsValue({ shiftNames: [] });
            }
        }
    };

    return (
        <Modal
            title={`Log Ad-Hoc Delay / Leave for Dr. ${doctor?.personalInfo?.lastName || ''}`}
            open={visible}
            onCancel={onCancel}
            onOk={() => form.submit()}
            okText="Save Changes"
            destroyOnClose
            okButtonProps={{ disabled: todayShifts?.length === 0 }} 
        >
            <Form form={form} layout="vertical" onFinish={onSave} onValuesChange={handleValuesChange}>
                <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
                    Select specific shifts to log a delay. To cancel the doctor's entire schedule for today, simply toggle the "Cancel Entire Day" switch.
                </Text>

                {todayShifts?.length === 0 && (
                    <Alert 
                        message="No Shifts Today" 
                        description="This doctor does not have any shifts scheduled for today." 
                        type="warning" 
                        showIcon 
                        style={{ marginBottom: '16px' }}
                    />
                )}

                <Form.Item name="date" label="Date" rules={[{ required: true }]}>
                    <DatePicker format="YYYY-MM-DD" style={{ width: '100%' }} disabled />
                </Form.Item>
                
                <Form.Item name="shiftNames" label="Which Shift(s)?" rules={[{ required: true, message: 'Please select at least one shift' }]}>
                    <Select 
                        mode="multiple" 
                        placeholder="Select affected shifts" 
                        // Disabled if they clicked Cancel Entire Day
                        disabled={todayShifts?.length === 0 || isCancelled}
                        allowClear
                    >
                        {todayShifts?.map((shift, idx) => (
                            <Option key={idx} value={shift.shiftName}>
                                {shift.shiftName} ({shift.startTime} - {shift.endTime})
                            </Option>
                        ))}
                    </Select>
                </Form.Item>
                
                <Row gutter={16}>
                    <Col span={12}>
                        {/* DYNAMIC VALIDATION ADDED HERE */}
                        <Form.Item 
                            name="delayMinutes" 
                            label="Delay (Minutes)" 
                            initialValue={0}
                            rules={[
                                ({ getFieldValue }) => ({
                                    validator(_, value) {
                                        // If day is cancelled, delay doesn't matter, auto-pass
                                        if (getFieldValue('isCancelled')) {
                                            return Promise.resolve();
                                        }
                                        // If not cancelled, delay MUST be > 0
                                        if (value === undefined || value <= 0) {
                                            return Promise.reject(new Error('Delay must be greater than 0 minutes.'));
                                        }
                                        return Promise.resolve();
                                    },
                                }),
                            ]}
                        >
                            <InputNumber 
                                style={{ width: '100%' }} 
                                min={0} 
                                // Disabled if they clicked Cancel Entire Day
                                disabled={todayShifts?.length === 0 || isCancelled} 
                            />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item 
                            name="isCancelled" 
                            label={<Text type="danger" strong>Cancel Entire Day?</Text>} 
                            valuePropName="checked"
                        >
                            <Switch checkedChildren="Yes" unCheckedChildren="No" disabled={todayShifts?.length === 0} />
                        </Form.Item>
                    </Col>
                </Row>
                
                <Form.Item name="note" label="Note / Reason to show patients">
                    <Input.TextArea placeholder="Doctor is attending an emergency..." disabled={todayShifts?.length === 0} />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default DoctorOverrideModal;