import React, { useEffect } from 'react';
import { Form, Input, InputNumber, Modal, DatePicker, TimePicker, message, Alert } from 'antd';
import dayjs from 'dayjs';
import { createSpecialShift } from '../../redux/apiCalls';

const DoctorSpecialShiftModal = ({ visible, onCancel, onSuccess, doctor }) => {
    const [form] = Form.useForm();

    useEffect(() => {
        if (visible) {
            form.resetFields();
            // Default to tomorrow to prevent accidentally adding shifts in the past
            form.setFieldsValue({
                date: dayjs().add(1, 'day')
            });
        }
    }, [visible, form]);

    const handleSave = async (values) => {
        try {
            const formattedValues = {
                ...values,
                date: values.date.format("YYYY-MM-DD"),
                startTime: values.timeRange[0].format("HH:mm"),
                endTime: values.timeRange[1].format("HH:mm"),
            };
            
            // Call the API
            await createSpecialShift(doctor._id, formattedValues);
            
            message.success(`Special Shift added for Dr. ${doctor.personalInfo.lastName}`);
            onSuccess(); // Triggers a table refresh
        } catch (error) {
            message.error(error.response?.data?.message || "Failed to create special shift.");
        }
    };

    return (
        <Modal
            title={`Schedule Special Shift for Dr. ${doctor?.personalInfo?.lastName || ''}`}
            open={visible}
            onCancel={onCancel}
            onOk={() => form.submit()}
            okText="Create Shift"
            destroyOnClose
        >
            <Alert 
                message="Ad-Hoc / Special Shift" 
                description="Use this to open up extra booking slots for a single day (e.g. clearing a backlog, Sunday emergency clinic)." 
                type="info" 
                showIcon 
                style={{ marginBottom: 16 }}
            />

            <Form form={form} layout="vertical" onFinish={handleSave}>
                <Form.Item name="date" label="Date" rules={[{ required: true }]}>
                    <DatePicker style={{ width: '100%' }} disabledDate={current => current && current < dayjs().startOf('day')} />
                </Form.Item>
                
                <Form.Item name="shiftName" label="Shift Name" rules={[{ required: true }]} initialValue="Special / Emergency">
                    <Input placeholder="e.g. VIP Consultation, Emergency Overtime" />
                </Form.Item>
                
                <Form.Item name="timeRange" label="Time Range" rules={[{ required: true }]}>
                    <TimePicker.RangePicker format="HH:mm" style={{ width: '100%' }} />
                </Form.Item>
                
                <Form.Item name="maxTokens" label="Maximum Tokens (Patients)" rules={[{ required: true }]} initialValue={5}>
                    <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>

                <Form.Item name="note" label="Internal Notes">
                    <Input.TextArea rows={2} placeholder="Reason for special shift..." />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default DoctorSpecialShiftModal;