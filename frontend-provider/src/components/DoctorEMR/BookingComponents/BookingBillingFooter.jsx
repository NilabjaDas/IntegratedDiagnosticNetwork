import React from 'react';
import { Form, Row, Col, Input, InputNumber, Checkbox, Select, Button, Typography } from 'antd';
import { ThunderboltFilled } from '@ant-design/icons';

const { Option } = Select;
const { Text } = Typography;

const BookingBillingFooter = ({ form, totalAmount, netAmount, dueAmount, paidAmount, loading, selectedDoctorId, availableShifts }) => {
    return (
        <div style={{ padding: "12px 16px", background: "#fff", borderTop: "1px solid #d9d9d9", boxShadow: "0 -2px 10px rgba(0,0,0,0.05)" }}>
            <Row gutter={16} align="middle">
                <Col span={6}>
                    <Form.Item name="notes" noStyle>
                        <Input.TextArea placeholder="Internal Notes..." rows={2} size="small" />
                    </Form.Item>
                </Col>
                <Col span={12} style={{ padding: "0 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f9fafc", border: "1px solid #e8e8e8", borderRadius: 8, padding: "8px 12px" }}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                            <Text type="secondary" style={{ fontSize: 9, fontWeight: 600 }}>FEE</Text>
                            <Text strong style={{ fontSize: 16 }}>₹{totalAmount}</Text>
                        </div>
                        <div style={{ fontSize: 18, color: "#d9d9d9", fontWeight: 300 }}>−</div>
                        <div style={{ width: 110, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                            <Text type="secondary" style={{ fontSize: 9, fontWeight: 600 }}>DISCOUNT</Text>
                            <Form.Item name="discountAmount" noStyle>
                                <InputNumber style={{ width: "100%", borderRadius: 4 }} size="small" min={0} max={totalAmount} placeholder="0" />
                            </Form.Item>
                            <Form.Item noStyle shouldUpdate={(prev, curr) => prev.discountAmount !== curr.discountAmount}>
                                {({ getFieldValue }) => getFieldValue("discountAmount") > 0 && (
                                    <Form.Item name="discountReason" rules={[{ required: true, message: "Req" }]} style={{ marginBottom: 0, marginTop: 2 }}>
                                        <Input size="small" placeholder="Reason" style={{ fontSize: 10, background: "#fff1f0" }} />
                                    </Form.Item>
                                )}
                            </Form.Item>
                        </div>
                        <div style={{ fontSize: 18, color: "#d9d9d9", fontWeight: 300 }}>=</div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", background: "#e6f7ff", padding: "4px 8px", borderRadius: 4, border: "1px solid #bae7ff" }}>
                            <Text style={{ fontSize: 9, fontWeight: 700, color: "#0050b3" }}>PAYABLE</Text>
                            <Text style={{ fontSize: 18, fontWeight: "bold", color: "#1890ff", lineHeight: 1 }}>₹{netAmount}</Text>
                        </div>
                    </div>
                </Col>
                <Col span={6}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
                        <Form.Item name="paidAmount" noStyle>
                            <InputNumber size="small" placeholder="Advance" style={{ width: "100%" }} max={netAmount} addonBefore="Paid" />
                        </Form.Item>
                        <Checkbox style={{ fontSize: 12 }} checked={paidAmount === netAmount && netAmount > 0} onChange={(e) => form.setFieldsValue({ paidAmount: e.target.checked ? netAmount : 0 })}>Full</Checkbox>
                    </div>
                    {paidAmount > 0 && (
                        <Form.Item name="paymentMode" noStyle>
                            <Select size="small" style={{ width: "100%", marginBottom: 6 }} placeholder="Mode">
                                <Option value="Cash">Cash</Option>
                                <Option value="Razorpay">UPI / QR</Option>
                                <Option value="Card">Card</Option>
                            </Select>
                        </Form.Item>
                    )}
                    <Button type="primary" htmlType="submit" loading={loading} block icon={<ThunderboltFilled />} disabled={!selectedDoctorId || availableShifts.length === 0}>
                        {paidAmount < netAmount ? `Book (Due: ₹${dueAmount})` : "Book & Paid"}
                    </Button>
                </Col>
            </Row>
        </div>
    );
};

export default BookingBillingFooter;