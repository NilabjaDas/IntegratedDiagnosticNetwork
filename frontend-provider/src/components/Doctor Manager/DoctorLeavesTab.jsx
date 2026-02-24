import React from 'react';
import { Form, Input, Button, Space, Typography, DatePicker } from 'antd';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const DoctorLeavesTab = () => {
    // Function to disable days before today
    const disabledDate = (current) => {
        return current && current < dayjs().startOf('day');
    };

    return (
        <div style={{ padding: '10px 0' }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
                Add dates when the doctor will be on vacation or at a conference. Patients will not be able to book these dates.
            </Text>
            <Form.List name="leaves">
                {(fields, { add, remove }) => (
                    <>
                        {fields.map(({ key, name, ...restField }) => (
                            <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                <Form.Item {...restField} name={[name, 'dateRange']} rules={[{ required: true, message: 'Dates required' }]}>
                                    <RangePicker 
                                        format="YYYY-MM-DD" 
                                        disabledDate={disabledDate} 
                                    />
                                </Form.Item>
                                <Form.Item {...restField} name={[name, 'reason']}>
                                    <Input placeholder="Reason (e.g. Conference)" style={{ width: 250 }} />
                                </Form.Item>
                                <MinusCircleOutlined onClick={() => remove(name)} style={{ color: 'red' }} />
                            </Space>
                        ))}
                        <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                            Add Planned Leave
                        </Button>
                    </>
                )}
            </Form.List>
        </div>
    );
};

export default DoctorLeavesTab;