import React, { useEffect, useState } from 'react';
import { Form, Input, InputNumber, Row, Col, Typography, Modal, Switch, DatePicker, Select, Alert } from 'antd';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;

const DoctorOverrideModal = ({ visible, onCancel, onSave, doctor }) => {
    const [form] = Form.useForm();
    const isFullDayCancel = Form.useWatch('isFullDayCancel', form);
    const [todayShifts, setTodayShifts] = useState([]);

    useEffect(() => {
        if (visible && doctor) {
            form.resetFields();
            
            const todayObj = dayjs();
            const todayStr = todayObj.format('YYYY-MM-DD');
            const todayIndex = todayObj.day();
            const weekOfMonth = Math.ceil(todayObj.date() / 7);
            
            // 1. Get Regular Shifts for Today
            const todaysSchedule = doctor.schedule?.find(s => s.dayOfWeek === todayIndex);
            let regularShifts = [];
            if (todaysSchedule && todaysSchedule.isAvailable) {
                regularShifts = todaysSchedule.shifts.filter(shift => {
                    if (shift.repeatWeeks && shift.repeatWeeks.length > 0) return shift.repeatWeeks.includes(weekOfMonth);
                    return true;
                });
            }

            // 2. Get Special Shifts for Today
            const specialShiftsForToday = doctor.specialShifts?.filter(s => s.date === todayStr && s.status !== 'Cancelled') || [];

            // 3. Merge them (Special shifts override regular shifts with the same name)
            let combinedShifts = [...regularShifts];
            specialShiftsForToday.forEach(special => {
                const existingIdx = combinedShifts.findIndex(s => s.shiftName === special.shiftName);
                if(existingIdx > -1) combinedShifts[existingIdx] = special;
                else combinedShifts.push(special);
            });

            setTodayShifts(combinedShifts);

            // Extract existing overrides for today
            const todaysOverrides = doctor.dailyOverrides?.filter(o => o.date === todayStr) || [];
            
            // Check if Full Day is currently cancelled
            const cancelledShifts = todaysOverrides.filter(o => o.isCancelled).flatMap(o => o.shiftNames || []);
            const uniqueCancelledShifts = [...new Set(cancelledShifts)];
            const isFullDayCancelInit = combinedShifts.length > 0 && uniqueCancelledShifts.length >= combinedShifts.length;

            // Map out the shifts and inject any existing overrides
            const initialShifts = combinedShifts.map(s => {
                const shiftOverride = todaysOverrides.find(o => o.shiftNames?.includes(s.shiftName) || (!o.shiftNames || o.shiftNames.length === 0));
                
                let status = 'Normal';
                let delayMinutes = null;

                if (shiftOverride) {
                    if (shiftOverride.isCancelled) {
                        status = 'Cancelled';
                    } else if (shiftOverride.delayMinutes > 0) {
                        status = 'Late';
                        delayMinutes = shiftOverride.delayMinutes;
                    }
                }

                return {
                    shiftName: s.shiftName,
                    status: status,
                    delayMinutes: delayMinutes
                };
            });

            form.setFieldsValue({ 
                date: todayObj,
                isFullDayCancel: isFullDayCancelInit,
                shifts: initialShifts,
                note: todaysOverrides[0]?.note || ''
            });
        }
    }, [visible, doctor, form]);

    const handleSubmit = (values) => {
        const payload = {
            date: values.date.format("YYYY-MM-DD"), 
            isFullDayCancel: values.isFullDayCancel,
            note: values.note,
            overrides: []
        };

        if (!values.isFullDayCancel && values.shifts) {
            values.shifts.forEach(shift => {
                if (shift.status === 'Late' && shift.delayMinutes > 0) {
                    payload.overrides.push({ shiftNames: [shift.shiftName], delayMinutes: shift.delayMinutes, isCancelled: false });
                } else if (shift.status === 'Cancelled') {
                    payload.overrides.push({ shiftNames: [shift.shiftName], delayMinutes: 0, isCancelled: true });
                }
            });
        }

        onSave(payload);
    };

    return (
        <Modal
            title={`Adjust Today's Schedule: Dr. ${doctor?.personalInfo?.lastName || ''}`}
            open={visible}
            onCancel={onCancel}
            onOk={() => form.submit()}
            okText="Save Adjustments"
            destroyOnClose
            width={600}
            okButtonProps={{ disabled: todayShifts?.length === 0 }} 
        >
            <Form form={form} layout="vertical" onFinish={handleSubmit}>
                <Alert 
                    message="Granular Schedule Control" 
                    description="You can cancel the entire day, or apply specific delays and cancellations to individual shifts (including special shifts)." 
                    type="info" 
                    showIcon 
                    style={{ marginBottom: '16px' }}
                />

                {todayShifts?.length === 0 && (
                    <Alert message="No Shifts Today" description="This doctor has no regular or special shifts scheduled for today." type="warning" showIcon style={{ marginBottom: '16px' }} />
                )}

                <Form.Item name="date" label="Date" rules={[{ required: true }]}>
                    <DatePicker format="YYYY-MM-DD" style={{ width: '100%' }} disabled />
                </Form.Item>

                <Form.Item 
                    name="isFullDayCancel" 
                    label={<Text type="danger" strong>Emergency: Cancel Entire Day?</Text>} 
                    valuePropName="checked"
                >
                    <Switch checkedChildren="Yes" unCheckedChildren="No" disabled={todayShifts?.length === 0} />
                </Form.Item>

                {/* DYNAMIC SHIFT LIST */}
                {!isFullDayCancel && todayShifts?.length > 0 && (
                    <div style={{ background: '#fafafa', padding: '16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #e8e8e8' }}>
                        <Text strong style={{ display: 'block', marginBottom: '12px' }}>Individual Shift Adjustments</Text>
                        <Form.List name="shifts">
                            {(fields) => (
                                <>
                                    {fields.map(({ key, name, ...restField }) => (
                                        <Row key={key} gutter={16} align="middle" style={{ marginBottom: 12 }}>
                                            <Col span={7}>
                                                <Form.Item {...restField} name={[name, 'shiftName']} style={{ margin: 0 }}>
                                                    <Input bordered={false} readOnly style={{ fontWeight: 'bold', padding: 0 }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={8}>
                                                <Form.Item {...restField} name={[name, 'status']} style={{ margin: 0 }}>
                                                    <Select>
                                                        <Option value="Normal">Normal</Option>
                                                        <Option value="Late">Late (Delay)</Option>
                                                        <Option value="Cancelled">Cancelled</Option>
                                                    </Select>
                                                </Form.Item>
                                            </Col>
                                            <Col span={9}>
                                                <Form.Item
                                                    noStyle
                                                    shouldUpdate={(prevValues, currentValues) => 
                                                        prevValues.shifts?.[name]?.status !== currentValues.shifts?.[name]?.status
                                                    }
                                                >
                                                    {() => {
                                                        return form.getFieldValue(['shifts', name, 'status']) === 'Late' ? (
                                                            <Form.Item 
                                                                {...restField} 
                                                                name={[name, 'delayMinutes']} 
                                                                style={{ margin: 0 }}
                                                                rules={[{ required: true, message: 'Required' }]}
                                                            >
                                                                <InputNumber min={1} placeholder="Minutes" style={{ width: '100%' }} />
                                                            </Form.Item>
                                                        ) : null;
                                                    }}
                                                </Form.Item>
                                            </Col>
                                        </Row>
                                    ))}
                                </>
                            )}
                        </Form.List>
                    </div>
                )}
                
                <Form.Item name="note" label="Internal Note / Reason">
                    <Input.TextArea placeholder="e.g. Doctor stuck in traffic..." disabled={todayShifts?.length === 0} />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default DoctorOverrideModal;