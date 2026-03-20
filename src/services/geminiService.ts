export async function generateEmailDraft(clientName: string, appointmentDate: string, serviceName: string) {
  return `Hi ${clientName},

This is a confirmation for your ${serviceName} appointment on ${appointmentDate}. 

We are excited to see you! Please arrive 5 minutes early to your appointment at Hunny, bee you! Studio.

Best,
Alexis Tucker
Hunny, bee you! Studio`;
}

export async function generateServiceDescription(serviceName: string) {
  return `A premium ${serviceName} service tailored just for you at Hunny, bee you! Studio. Experience expert craft and self-expression.`;
}
