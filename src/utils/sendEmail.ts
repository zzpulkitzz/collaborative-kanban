import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
console.log("AUTH HEADER:", `Bearer ${process.env.SENDGRID_API_KEY}`,);
export async function sendAssignmentEmail(args: {
  to: string;
  cardTitle: string;
  boardTitle: string;
  assignedBy: string;
  type?: 'created' | 'updated';
}) {
    console.log("Sending Emailll")
  const { to, cardTitle, boardTitle, assignedBy, type } = args;
  console.log(process.env.SENDGRID_VERIFIED_SENDER,process.env.SENDGRID_API_KEY,to)
  return sgMail.send({
    to,
    from: process.env.SENDGRID_VERIFIED_SENDER!, // Your verified "from" address
    subject: `Task Assigned: "${cardTitle}" [${boardTitle}]`,
    html: `
      <p>Hello,</p>
      <p>
        You have been ${type === 'created' ? 'assigned to a new card' : 'reassigned to a card'} <b>"${cardTitle}"</b>
        in board <b>${boardTitle}</b> by <b>${assignedBy}</b>.
      </p>
      <p>Please log in to your Kanban board to view details.</p>
    `,
  });
}
