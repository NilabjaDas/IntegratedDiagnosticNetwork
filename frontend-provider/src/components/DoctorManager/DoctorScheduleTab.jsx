import React from 'react';
import { Form, Input, InputNumber, Row, Button, Space, Typography, Card, Switch, TimePicker, Dropdown, message, Divider } from 'antd';
import { PlusOutlined, MinusCircleOutlined, CopyOutlined, CoffeeOutlined } from '@ant-design/icons';

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
                        timeRange: shift.timeRange ? [...shift.timeRange] : undefined,
                        breaks: shift.breaks ? shift.breaks.map(b => ({
                            ...b,
                            timeRange: b.timeRange ? [...b.timeRange] : undefined
                        })) : []
                    })) : []
                };
            }
            return day;
        });

        form.setFieldsValue({ schedule: updatedSchedule });
        message.success(`Schedule copied to ${targetType === 'all' ? 'All 7 Days' : 'Monday - Friday'}!`);
    };

    const checkOverlappingShifts = async (_, shifts) => {
        if (!shifts || shifts.length < 2) return Promise.resolve();
        const validShifts = shifts.filter(s => s && s.timeRange && s.timeRange.length === 2);
        if (validShifts.length < 2) return Promise.resolve();
        const sortedShifts = [...validShifts].sort((a, b) => a.timeRange[0].valueOf() - b.timeRange[0].valueOf());
        for (let i = 0; i < sortedShifts.length - 1; i++) {
            if (sortedShifts[i].timeRange[1].valueOf() > sortedShifts[i + 1].timeRange[0].valueOf()) {
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
                                        <Dropdown menu={{ items: [
                                            { key: 'weekdays', label: 'Copy to Mon - Fri', onClick: () => handleCopySchedule(index, 'weekdays') },
                                            { key: 'all', label: 'Copy to All 7 Days', onClick: () => handleCopySchedule(index, 'all') }
                                        ]}}>
                                            <Button type="link" size="small" icon={<CopyOutlined />}>Copy...</Button>
                                        </Dropdown>
                                        <Form.Item name={[name, 'isAvailable']} valuePropName="checked" style={{ margin: 0 }}>
                                            <Switch checkedChildren="Working" unCheckedChildren="Off" />
                                        </Form.Item>
                                    </Space>
                                </Row>
                                
                                <Form.Item noStyle shouldUpdate={(prev, curr) => prev?.schedule?.[index]?.isAvailable !== curr.schedule?.[index]?.isAvailable}>
                                    {() => (
                                        form.getFieldValue(['schedule', index, 'isAvailable']) ? (
                                            <Form.List name={[name, 'shifts']} rules={[{ validator: checkOverlappingShifts }]}>
                                                {(shiftFields, { add: addShift, remove: removeShift }, { errors }) => (
                                                    <div style={{ marginTop: 16 }}>
                                                        {shiftFields.map((shiftField) => (
                                                            <div key={shiftField.key} style={{ padding: 12, background: '#fff', border: '1px solid #e8e8e8', borderRadius: 6, marginBottom: 12 }}>
                                                                <Space style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                                                    <Form.Item {...shiftField} name={[shiftField.name, 'shiftName']} rules={[{ required: true, message: 'Name required' }]}>
                                                                        <Input placeholder="Shift Name (e.g. Morning)" style={{ width: 180 }} />
                                                                    </Form.Item>
                                                                    <Form.Item {...shiftField} name={[shiftField.name, 'timeRange']} rules={[{ required: true, message: 'Time required' }]}>
                                                                        <TimePicker.RangePicker format="HH:mm" style={{ width: 220 }} />
                                                                    </Form.Item>
                                                                    <Form.Item {...shiftField} name={[shiftField.name, 'maxTokens']} rules={[{ required: true, message: 'Required' }]}>
                                                                        <InputNumber placeholder="Max Tokens" min={1} style={{ width: 120 }} />
                                                                    </Form.Item>
                                                                    <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => removeShift(shiftField.name)}>Remove Shift</Button>
                                                                </Space>

                                                                {/* NEW: NESTED BREAKS ARRAY */}
                                                                <Form.List name={[shiftField.name, 'breaks']}>
                                                                    {(breakFields, { add: addBreak, remove: removeBreak }) => (
                                                                        <div style={{ marginLeft: 24, paddingLeft: 12, borderLeft: '2px dashed #d9d9d9' }}>
                                                                            {breakFields.map(breakField => (
                                                                                <Space key={breakField.key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                                                                    <Form.Item {...breakField} name={[breakField.name, 'label']} initialValue="Break">
                                                                                        <Input placeholder="Label (e.g. Lunch)" size="small" style={{ width: 140 }} />
                                                                                    </Form.Item>
                                                                                    <Form.Item {...breakField} name={[breakField.name, 'timeRange']} rules={[{ required: true }]}>
                                                                                        <TimePicker.RangePicker format="HH:mm" size="small" style={{ width: 200 }} />
                                                                                    </Form.Item>
                                                                                    <MinusCircleOutlined onClick={() => removeBreak(breakField.name)} style={{ color: 'red', cursor: 'pointer' }} />
                                                                                </Space>
                                                                            ))}
                                                                            <Button type="dashed" size="small" onClick={() => addBreak()} icon={<CoffeeOutlined />}>
                                                                                Add Break
                                                                            </Button>
                                                                        </div>
                                                                    )}
                                                                </Form.List>
                                                            </div>
                                                        ))}
                                                        <Button type="dashed" onClick={() => addShift()} icon={<PlusOutlined />} size="small">
                                                            Add Shift to {DAYS_OF_WEEK[index]}
                                                        </Button>
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