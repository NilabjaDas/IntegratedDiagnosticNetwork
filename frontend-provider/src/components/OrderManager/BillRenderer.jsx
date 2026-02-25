import React from "react";
import styled from "styled-components";
import moment from "moment";

// Styled container that mimics paper
const PrintContainer = styled.div`
  background: white;
  width: ${props => props.pageSize === 'A5' ? '148mm' : '210mm'};
  min-height: 297mm; /* A4 height */
  padding: 10mm;
  margin: 0 auto;
  font-family: ${props => props.font || 'Roboto'}, sans-serif;
  color: #333;
  
  /* Print specific styles */
  @media print {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    margin: 0;
    padding: 10mm;
    box-shadow: none;
  }
`;

const Header = styled.div`
  border-bottom: 2px solid ${props => props.color};
  padding-bottom: 10px;
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
  
  th {
    background: ${props => props.color};
    color: white;
    padding: 8px;
    text-align: left;
  }
  td {
    border-bottom: 1px solid #eee;
    padding: 8px;
  }
`;

const BillRenderer = React.forwardRef(({ order, template, institution }, ref) => {
    if (!order || !template) return null;

    const { content } = template;
    const total = order.financials.totalAmount;
    const discount = order.financials.discountAmount;
    const net = order.financials.netAmount;
    const paid = order.financials.paidAmount;
    const due = order.financials.dueAmount;

    return (
        <div style={{ display: 'none' }}>
            <PrintContainer ref={ref} pageSize={template.pageSize} font={content.fontFamily}>
                
                {/* HEADER */}
                <Header color={content.accentColor}>
                    <div>
                        {content.showLogo && institution?.institutionLogoUrl && (
                            <img src={institution.institutionLogoUrl} alt="Logo" style={{ height: 50, marginBottom: 10 }} />
                        )}
                        {/* Inject Custom Header HTML safely */}
                        <div dangerouslySetInnerHTML={{ __html: content.headerHtml }} />
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <h1>INVOICE</h1>
                        <div>#{order.displayId}</div>
                        <div>{moment(order.createdAt).format("DD MMM YYYY")}</div>
                    </div>
                </Header>

                {/* PATIENT INFO */}
                <div style={{ marginBottom: 20 }}>
                    <strong>Bill To:</strong><br/>
                    {order.patientId?.firstName} {order.patientId?.lastName}<br/>
                    {order.patientId?.mobile}<br/>
                    {order.patientId?.age} Y / {order.patientId?.gender}
                </div>

                {/* ITEMS TABLE */}
                <Table color={content.accentColor}>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Service</th>
                            <th style={{textAlign: 'right'}}>Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        {order.items.map((item, idx) => (
                            <tr key={idx}>
                                <td>{idx + 1}</td>
                                <td>{item.name} <small>{item.itemType === 'Package' ? '(Pkg)' : ''}</small></td>
                                <td style={{textAlign: 'right'}}>₹{item.price}</td>
                            </tr>
                        ))}
                    </tbody>
                </Table>

                {/* TOTALS */}
                <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ width: '200px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Total:</span>
                            <span>₹{total}</span>
                        </div>
                        {discount > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'red' }}>
                                <span>Discount:</span>
                                <span>-₹{discount}</span>
                            </div>
                        )}
                         <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px solid #ccc', paddingTop: 5, marginTop: 5 }}>
                            <span>Net Payable:</span>
                            <span>₹{net}</span>
                        </div>
                         <div style={{ display: 'flex', justifyContent: 'space-between', color: 'green' }}>
                            <span>Paid:</span>
                            <span>₹{paid}</span>
                        </div>
                        {due > 0 && (
                             <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cf1322', fontWeight: 'bold' }}>
                                <span>Due:</span>
                                <span>₹{due}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* FOOTER */}
                <div 
                    style={{ marginTop: 50, borderTop: '1px solid #eee', paddingTop: 10, textAlign: 'center', fontSize: 12, color: '#888' }}
                    dangerouslySetInnerHTML={{ __html: content.footerHtml }} 
                />
                
            </PrintContainer>
        </div>
    );
});

export default BillRenderer;