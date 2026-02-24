import React from 'react';
import { Card, Row, Col, Typography, Select, DatePicker } from 'antd';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;

const WorkspaceHeader = ({ doctors, selectedDoctorId, setSelectedDoctorId, selectedDate, setSelectedDate }) => {
    return (
        <Card size="small" style={{ marginBottom: 16 }}>
            <Row gutter={16} align="middle">
                <Col>
                    <Text strong>Select Doctor Workspace: </Text>
                </Col>
                <Col span={6}>
                    <Select 
                        style={{ width: '100%' }} 
                        placeholder="Select Doctor" 
                        value={selectedDoctorId}
                        onChange={setSelectedDoctorId}
                        showSearch
                        optionFilterProp="children"
                    >
                        {doctors.map(d => (
                            <Option key={d._id} value={d._id}>
                                Dr. {d.personalInfo?.firstName} {d.personalInfo?.lastName}
                            </Option>
                        ))}
                    </Select>
                </Col>
                <Col>
                    <Text strong>Date: </Text>
                </Col>
                <Col>
                    <DatePicker 
                        value={dayjs(selectedDate, "YYYY-MM-DD")} 
                        onChange={(d) => setSelectedDate(d ? d.format("YYYY-MM-DD") : null)} 
                        allowClear={false}
                    />
                </Col>
            </Row>
        </Card>
    );
};

export default WorkspaceHeader;