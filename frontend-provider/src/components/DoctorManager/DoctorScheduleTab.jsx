import React from 'react';
import { Form, Input, InputNumber, Row, Button, Space, Typography, Card, Switch, TimePicker, Dropdown, message } from 'antd';
import { PlusOutlined, MinusCircleOutlined, CopyOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DoctorScheduleTab = ({ form }) => {

    const handleCopySchedule = (sourceIndex, targetType) => {
        const currentSchedule = form.getFieldValue('schedule');
        const sourceDay = currentSchedule[sourceIndex];

        const updatedSchedule = currentSchedule.map((day, i) => {
            if (i === sourceIndex) return day;

            let shouldCopy = false;
            if (targetType === 'all') shouldCopy = true;
            if (targetType === 'weekdays' && i >= 1 && i <= 5) shouldCopy = true;

            if (shouldCopy) {
                return {
                    ...day,
                    isAvailable: sourceDay.isAvailable,
                    shifts: sourceDay.shifts ? sourceDay.shifts.map(shift => ({
                        ...shift,
                        timeRange: shift.timeRange ? [...shift.timeRange] : undefined
                    })) : []
                };
            }
            return day;
        });

        form.setFieldsValue({ schedule: updatedSchedule });
        message.success(`Schedule copied to ${targetType === 'all' ? 'All 7 Days' : 'Monday - Friday'}!`);
    };

    // --- OVERLAP VALIDATOR ---
    const checkOverlappingShifts = async (_, shifts) => {
        if (!shifts || shifts.length < 2) return Promise.resolve();

        // Filter out shifts that don't have a timeRange selected yet
        const validShifts = shifts.filter(s => s && s.timeRange && s.timeRange.length === 2);
        if (validShifts.length < 2) return Promise.resolve();

        // Sort shifts by Start Time
        const sortedShifts = [...validShifts].sort((a, b) => {
            return a.timeRange[0].valueOf() - b.timeRange[0].valueOf();
        });

        // Check for overlaps
        for (let i = 0; i < sortedShifts.length - 1; i++) {
            const currentEndTime = sortedShifts[i].timeRange[1].valueOf();
            const nextStartTime = sortedShifts[i + 1].timeRange[0].valueOf();

            if (currentEndTime > nextStartTime) {
                return Promise.reject(new Error('Shifts cannot overlap in time.'));
            }
        }
        return Promise.resolve();
    };

    return (
        <div style={{ padding: '10px 0' }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
                Set up a day's schedule, then use the <strong>Copy</strong> button to instantly apply it to other days.
            </Text>
            <Form.List name="schedule">
                {(fields) => (
                    <>
                        {fields.map(({ key, name, ...restField }, index) => (
                            <Card key={key} size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
                                <Row align="middle" justify="space-between" style={{ marginBottom: 8 }}>
                                    <Title level={5} style={{ margin: 0 }}>{DAYS_OF_WEEK[index]}</Title>
                                    
                                    <Space size="large">
                                        <Dropdown 
                                            menu={{
                                                items: [
                                                    { key: 'weekdays', label: 'Copy to Mon - Fri', onClick: () => handleCopySchedule(index, 'weekdays') },
                                                    { key: 'all', label: 'Copy to All 7 Days', onClick: () => handleCopySchedule(index, 'all') }
                                                ]
                                            }}
                                        >
                                            <Button type="link" size="small" icon={<CopyOutlined />}>Copy...</Button>
                                        </Dropdown>

                                        <Form.Item name={[name, 'isAvailable']} valuePropName="checked" style={{ margin: 0 }}>
                                            <Switch checkedChildren="Working" unCheckedChildren="Off" />
                                        </Form.Item>
                                    </Space>
                                </Row>
                                
                                <Form.Item noStyle shouldUpdate={(prev, curr) => prev.schedule[index]?.isAvailable !== curr.schedule[index]?.isAvailable}>
                                    {() => (
                                        form.getFieldValue(['schedule', index, 'isAvailable']) ? (
                                            // ADDED VALIDATOR RULES HERE
                                            <Form.List name={[name, 'shifts']} rules={[{ validator: checkOverlappingShifts }]}>
                                                {(shiftFields, { add: addShift, remove: removeShift }, { errors }) => (
                                                    <div style={{ marginTop: 16 }}>
                                                        {shiftFields.map((shiftField) => (
                                                            <Space key={shiftField.key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                                                <Form.Item {...shiftField} name={[shiftField.name, 'shiftName']} rules={[{ required: true, message: 'Name required' }]}>
                                                                    <Input placeholder="Shift Name" style={{ width: 160 }} />
                                                                </Form.Item>
                                                                <Form.Item {...shiftField} name={[shiftField.name, 'timeRange']} rules={[{ required: true, message: 'Time required' }]}>
                                                                    <TimePicker.RangePicker format="HH:mm" style={{ width: 220 }} />
                                                                </Form.Item>
                                                                <Form.Item {...shiftField} name={[shiftField.name, 'maxTokens']} rules={[{ required: true, message: 'Required' }]}>
                                                                    <InputNumber placeholder="Max Tokens" min={1} style={{ width: 120 }} />
                                                                </Form.Item>
                                                                <MinusCircleOutlined onClick={() => removeShift(shiftField.name)} style={{ color: 'red', cursor: 'pointer' }} />
                                                            </Space>
                                                        ))}
                                                        <Button type="dashed" onClick={() => addShift()} icon={<PlusOutlined />} size="small">
                                                            Add Shift to {DAYS_OF_WEEK[index]}
                                                        </Button>
                                                        {/* RENDER THE OVERLAP ERROR MESSAGE HERE */}
                                                        <Form.ErrorList errors={errors} />
                                                    </div>
                                                )}
                                            </Form.List>
                                        ) : null
                                    )}
                                </Form.Item>
                            </Card>
                        ))}
                    </>
                )}
            </Form.List>
        </div>
    );
};

export default DoctorScheduleTab;