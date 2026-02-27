import React, { useState } from 'react';
import { Form, Input, InputNumber, Row, Col, Button, Space, Typography, Card, Switch, TimePicker, Dropdown, message, Divider, Tabs, Empty, Tag, Checkbox } from 'antd';
import { PlusOutlined, MinusCircleOutlined, CopyOutlined, CoffeeOutlined, DeleteOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// --- NEW: CUSTOM WEEK SELECTOR COMPONENT ---
// This automatically hooks into Ant Design's Form state via value/onChange
const WeekSelector = ({ value = [], onChange }) => {
    const allWeeks = [1, 2, 3, 4, 5];
    const isAllChecked = value.length === allWeeks.length;
    const isIndeterminate = value.length > 0 && value.length < allWeeks.length;

    const onCheckAllChange = (e) => {
        onChange(e.target.checked ? allWeeks : []);
    };

    const onGroupChange = (checkedList) => {
        onChange(checkedList);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: '#f9f9f9', padding: '4px 10px', borderRadius: 6, border: '1px solid #e8e8e8' }}>
            <Checkbox indeterminate={isIndeterminate} onChange={onCheckAllChange} checked={isAllChecked}>
                <b style={{ color: isAllChecked ? '#1890ff' : 'inherit' }}>Every Week</b>
            </Checkbox>
            <Checkbox.Group value={value} onChange={onGroupChange} style={{ display: 'flex', gap: 6 }}>
                <Checkbox value={1}>1st</Checkbox>
                <Checkbox value={2}>2nd</Checkbox>
                <Checkbox value={3}>3rd</Checkbox>
                <Checkbox value={4}>4th</Checkbox>
                <Checkbox value={5}>5th</Checkbox>
            </Checkbox.Group>
        </div>
    );
};


const DoctorScheduleTab = ({ form }) => {
    const [activeTab, setActiveTab] = useState("1"); // Default to Monday

    const handleCopySchedule = (sourceIndex, targetType) => {
        const currentSchedule = form.getFieldValue('schedule') || [];
        const sourceDay = currentSchedule[sourceIndex];

        if (!sourceDay) return;

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
                        repeatWeeks: shift.repeatWeeks ? [...shift.repeatWeeks] : [1, 2, 3, 4, 5],
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

    // Render the content for a specific day
    const renderDayEditor = (dayName, index) => {
        return (
            <div style={{ paddingLeft: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #f0f0f0' }}>
                    <div>
                        <Title level={4} style={{ margin: 0 }}>{dayName}</Title>
                        <Text type="secondary">Configure shifts, breaks, and repeating rules for every {dayName}.</Text>
                    </div>
                    <Space size="large">
                        <Dropdown menu={{ items: [
                            { key: 'weekdays', label: 'Copy to Mon - Fri', onClick: () => handleCopySchedule(index, 'weekdays') },
                            { key: 'all', label: 'Copy to All 7 Days', onClick: () => handleCopySchedule(index, 'all') }
                        ]}}>
                            <Button icon={<CopyOutlined />}>Copy Settings...</Button>
                        </Dropdown>
                        
                        <div style={{ background: '#e6f7ff', padding: '6px 12px', borderRadius: 8, border: '1px solid #91d5ff' }}>
                            <Form.Item name={['schedule', index, 'isAvailable']} valuePropName="checked" style={{ margin: 0 }}>
                                <Switch checkedChildren="Doctor Available" unCheckedChildren="Day Off" />
                            </Form.Item>
                        </div>
                    </Space>
                </div>

                <Form.Item noStyle shouldUpdate={(prev, curr) => prev.schedule?.[index]?.isAvailable !== curr.schedule?.[index]?.isAvailable}>
                    {() => {
                        const isAvailable = form.getFieldValue(['schedule', index, 'isAvailable']);
                        if (!isAvailable) {
                            return (
                                <Empty 
                                    image={Empty.PRESENTED_IMAGE_SIMPLE} 
                                    description={<span>Doctor is marked as <b>Off</b> on {dayName}s.</span>} 
                                />
                            );
                        }

                        return (
                            <Form.List name={['schedule', index, 'shifts']} rules={[{ validator: checkOverlappingShifts }]}>
                                {(shiftFields, { add: addShift, remove: removeShift }, { errors }) => (
                                    <div style={{ paddingBottom: 40 }}>
                                        {shiftFields.map((shiftField) => (
                                            <Card key={shiftField.key} size="small" style={{ marginBottom: 16, borderColor: '#d9d9d9', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                                                
                                                {/* OPTIMIZED WIDE-SCREEN GRID */}
                                                <Row gutter={16} align="top">
                                                    <Col span={5}>
                                                        <Form.Item {...shiftField} name={[shiftField.name, 'shiftName']} label="Shift Name" rules={[{ required: true, message: 'Required' }]}>
                                                            <Input placeholder="e.g. Morning OPD" />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={7}>
                                                        <Form.Item {...shiftField} name={[shiftField.name, 'timeRange']} label="Working Hours" rules={[{ required: true, message: 'Required' }]}>
                                                            <TimePicker.RangePicker format="HH:mm" style={{ width: '100%' }} />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={4}>
                                                        <Form.Item {...shiftField} name={[shiftField.name, 'maxTokens']} label="Max Patients" rules={[{ required: true }]}>
                                                            <InputNumber min={1} style={{ width: '100%' }} />
                                                        </Form.Item>
                                                    </Col>
                                                    
                                                    {/* NEW: CHECKBOX REPEAT RULE */}
                                                    <Col span={8}>
                                                        <Form.Item 
                                                            {...shiftField} 
                                                            name={[shiftField.name, 'repeatWeeks']} 
                                                            label="Active Weeks" 
                                                            initialValue={[1, 2, 3, 4, 5]}
                                                            rules={[{ required: true, message: 'Select at least 1 week' }]}
                                                        >
                                                            <WeekSelector />
                                                        </Form.Item>
                                                    </Col>
                                                </Row>

                                                <Divider style={{ margin: '8px 0' }} dashed />

                                                {/* NESTED BREAKS */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <Form.List name={[shiftField.name, 'breaks']}>
                                                            {(breakFields, { add: addBreak, remove: removeBreak }) => (
                                                                <div>
                                                                    {breakFields.map(breakField => (
                                                                        <Space key={breakField.key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                                                            <Form.Item {...breakField} name={[breakField.name, 'label']} initialValue="Break" style={{ margin: 0 }}>
                                                                                <Input placeholder="Label (e.g. Lunch)" size="small" style={{ width: 140 }} />
                                                                            </Form.Item>
                                                                            <Form.Item {...breakField} name={[breakField.name, 'timeRange']} rules={[{ required: true }]} style={{ margin: 0 }}>
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
                                                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeShift(shiftField.name)}>Delete Shift</Button>
                                                </div>
                                            </Card>
                                        ))}

                                        <Button type="dashed" onClick={() => addShift()} icon={<PlusOutlined />} block>
                                            Add New Shift to {dayName}
                                        </Button>
                                        <Form.ErrorList errors={errors} style={{ marginTop: 8 }} />
                                    </div>
                                )}
                            </Form.List>
                        );
                    }}
                </Form.Item>
            </div>
        );
    };

    return (
        <div style={{ minHeight: '500px' }}>
            <Tabs 
                tabPosition="left" 
                activeKey={activeTab} 
                onChange={setActiveTab}
                items={DAYS_OF_WEEK.map((dayName, index) => ({
                    label: (
                        <div style={{ width: 120, display: 'flex', justifyContent: 'space-between' }}>
                            <span>{dayName}</span>
                            {/* Visual indicator if a day is marked as off */}
                            <Form.Item noStyle shouldUpdate={(prev, curr) => prev.schedule?.[index]?.isAvailable !== curr.schedule?.[index]?.isAvailable}>
                                {() => !form.getFieldValue(['schedule', index, 'isAvailable']) ? <Tag color="default" style={{ margin: 0 }}>Off</Tag> : <Tag color="green" style={{ margin: 0 }}>On</Tag>}
                            </Form.Item>
                        </div>
                    ),
                    key: String(index),
                    children: renderDayEditor(dayName, index),
                    forceRender: true
                }))}
            />
        </div>
    );
};

export default DoctorScheduleTab;