import React, { useEffect, useState } from 'react';
import { Form, Input, InputNumber, Row, Col, Typography, Modal, Switch, DatePicker, Select, Alert } from 'antd';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;

const DoctorOverrideModal = ({ visible, onCancel, onSave, doctor }) => {
    const [form] = Form.useForm();
    const [isAllSelected, setIsAllSelected] = useState(false);

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
            
            // If there's only one shift today, auto-select it. 
            const defaultShifts = todayShifts?.length === 1 ? [todayShifts[0].shiftName] : [];
            
            form.setFieldsValue({ 
                date: today,
                shiftNames: defaultShifts
            });
            
            setIsAllSelected(todayShifts?.length === 1);
        }
    }, [visible, form, doctor, todayShifts]);

    // --- AUTO-TOGGLE LOGIC ---
    const handleValuesChange = (changedValues, allValues) => {
        if (changedValues.shiftNames) {
            const selectedCount = changedValues.shiftNames.length;
            const totalCount = todayShifts?.length || 0;

            if (selectedCount === totalCount && totalCount > 0) {
                // User selected ALL shifts -> Auto-mark as Cancelled
                form.setFieldsValue({ isCancelled: true, delayMinutes: 0 });
                setIsAllSelected(true);
            } else {
                setIsAllSelected(false);
                // If they deselect a shift, un-toggle the cancel switch just to be safe
                if (selectedCount < totalCount) {
                    form.setFieldsValue({ isCancelled: false });
                }
            }
        }
    };

    return (
        <Modal
            title={`Log Ad-Hoc Delay for Dr. ${doctor?.personalInfo?.firstName || ''}`}
            open={visible}
            onCancel={onCancel}
            onOk={() => form.submit()}
            okText="Apply Delay"
            destroyOnClose
            okButtonProps={{ disabled: todayShifts?.length === 0 }} 
        >
            <Form form={form} layout="vertical" onFinish={onSave} onValuesChange={handleValuesChange}>
                <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
                    Select the shifts affected. If all shifts are selected, the system will automatically prompt to cancel the entire day.
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
                        disabled={todayShifts?.length === 0}
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
                        <Form.Item name="delayMinutes" label="Delay (Minutes)" initialValue={0}>
                            {/* Disable delay if they are cancelling the shift anyway */}
                            <InputNumber 
                                style={{ width: '100%' }} 
                                min={0} 
                                disabled={todayShifts?.length === 0 || form.getFieldValue('isCancelled')} 
                            />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        {/* Dynamic Label based on selection */}
                        <Form.Item 
                            name="isCancelled" 
                            label={isAllSelected ? <Text type="danger">Cancel Entire Day?</Text> : "Cancel Selected Shift(s)?"} 
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