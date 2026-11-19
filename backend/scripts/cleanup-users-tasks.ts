import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const USERS_TO_KEEP = [
  'sana.moradi',
  'sana.karimi',
  'sana.ahmadi',
  'ali',
  'negar',
  'admin',
];

async function main() {
  console.log('🧹 Starting cleanup...');
  console.log('Users to keep:', USERS_TO_KEEP.join(', '));

  // 1. Get users to keep
  const keptUsers = await prisma.user.findMany({
    where: { username: { in: USERS_TO_KEEP } },
    select: { id: true, username: true, fullName: true },
  });

  console.log('\n✅ Found users to keep:');
  for (const u of keptUsers) {
    console.log(`   - ${u.username} (${u.fullName}) [${u.id}]`);
  }

  const keptUserIds = keptUsers.map(u => u.id);

  // 2. Delete all tasks
  console.log('\n🗑️ Deleting all tasks...');
  const deletedTasks = await prisma.task.deleteMany({});
  console.log(`   Deleted ${deletedTasks.count} tasks`);

  // 3. Delete related data for users to be removed
  const usersToDelete = await prisma.user.findMany({
    where: { username: { notIn: USERS_TO_KEEP } },
    select: { id: true, username: true, fullName: true, employeeId: true },
  });

  console.log(`\n🗑️ Found ${usersToDelete.length} users to delete:`);
  for (const u of usersToDelete) {
    console.log(`   - ${u.username} (${u.fullName}) [${u.id}]`);
  }

  const userIdsToDelete = usersToDelete.map(u => u.id);
  const employeeIdsToDelete = usersToDelete.map(u => u.employeeId).filter(Boolean) as string[];

  // Delete in correct order (foreign key constraints)
  if (userIdsToDelete.length > 0) {
    // User-related tables
    await prisma.userSession.deleteMany({ where: { userId: { in: userIdsToDelete } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIdsToDelete } } });
    await prisma.securityEvent.deleteMany({ where: { userId: { in: userIdsToDelete } } });
    await prisma.securityEvent.deleteMany({ where: { actorId: { in: userIdsToDelete } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: userIdsToDelete } } });
    await prisma.notification.deleteMany({ where: { userId: { in: userIdsToDelete } } });
    await prisma.notification.deleteMany({ where: { senderId: { in: userIdsToDelete } } });
    await prisma.savedFilter.deleteMany({ where: { userId: { in: userIdsToDelete } } });
    await prisma.reportRun.deleteMany({ where: { userId: { in: userIdsToDelete } } });
    await prisma.backupHistory.deleteMany({ where: { createdById: { in: userIdsToDelete } } });
    await prisma.loanInstallmentPayment.deleteMany({ where: { createdById: { in: userIdsToDelete } } });
    await prisma.systemError.deleteMany({ where: { userId: { in: userIdsToDelete } } });
    await prisma.evaluationFeedback.deleteMany({ where: { authorId: { in: userIdsToDelete } } });
    await prisma.surveyResponse.deleteMany({ where: { respondentId: { in: userIdsToDelete } } });
    await prisma.taskComment.deleteMany({ where: { authorId: { in: userIdsToDelete } } });
    await prisma.task.deleteMany({ where: { createdById: { in: userIdsToDelete } } });
    await prisma.task.deleteMany({ where: { retryRequestedById: { in: userIdsToDelete } } });
    await prisma.project.deleteMany({ where: { createdById: { in: userIdsToDelete } } });
    await prisma.taskAssignee.deleteMany({ where: { userId: { in: userIdsToDelete } } });
    await prisma.approvalTask.deleteMany({ where: { assigneeUserId: { in: userIdsToDelete } } });
    await prisma.approvalTask.deleteMany({ where: { decidedById: { in: userIdsToDelete } } });
    await prisma.approvalInstance.deleteMany({ where: { initiatedById: { in: userIdsToDelete } } });
    await prisma.interview.deleteMany({ where: { interviewerId: { in: userIdsToDelete } } });
    await prisma.interviewFeedback.deleteMany({ where: { interviewerId: { in: userIdsToDelete } } });
    await prisma.announcement.deleteMany({ where: { publishedById: { in: userIdsToDelete } } });
    await prisma.announcementAck.deleteMany({ where: { userId: { in: userIdsToDelete } } });
    await prisma.meeting.deleteMany({ where: { organizerId: { in: userIdsToDelete } } });
    await prisma.meetingParticipant.deleteMany({ where: { userId: { in: userIdsToDelete } } });
    await prisma.meetingAction.deleteMany({ where: { responsibleUserId: { in: userIdsToDelete } } });
    await prisma.survey.deleteMany({ where: { createdById: { in: userIdsToDelete } } });
    await prisma.suggestion.deleteMany({ where: { reporterId: { in: userIdsToDelete } } });
    await prisma.suggestion.deleteMany({ where: { responsibleId: { in: userIdsToDelete } } });
    await prisma.confidentialReport.deleteMany({ where: { reporterId: { in: userIdsToDelete } } });
    await prisma.correspondenceReferral.deleteMany({ where: { toUserId: { in: userIdsToDelete } } });
    await prisma.payslipViewLog.deleteMany({ where: { userId: { in: userIdsToDelete } } });
    await prisma.attendanceCorrection.deleteMany({ where: { requestedById: { in: userIdsToDelete } } });
    await prisma.attendanceCorrection.deleteMany({ where: { approvedById: { in: userIdsToDelete } } });
    await prisma.userRole.deleteMany({ where: { userId: { in: userIdsToDelete } } });
    await prisma.scopeAssignment.deleteMany({ where: { userId: { in: userIdsToDelete } } });

    // Employee-related (for deleted users' employees)
    if (employeeIdsToDelete.length > 0) {
      await prisma.employeeSkill.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.employeeDependent.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.employmentEvent.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.bankAccount.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.contract.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.employeeDocument.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.attendanceEvent.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.attendanceRecord.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.attendanceCorrection.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.shiftAssignment.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.leaveRequest.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.leaveTransaction.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.payrollItem.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.payrollAmendment.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.payslip.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.evaluation.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.goal.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.taskAssignee.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.asset.deleteMany({ where: { currentHolderId: { in: employeeIdsToDelete } } });
      await prisma.assetHandover.deleteMany({ where: { fromEmployeeId: { in: employeeIdsToDelete } } });
      await prisma.assetHandover.deleteMany({ where: { toEmployeeId: { in: employeeIdsToDelete } } });
      await prisma.trainingRecord.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.certificate.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.mission.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.loan.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.employeeBenefit.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.onboardingChecklist.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.offboardingChecklist.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.terminationRequest.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.meetingParticipant.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.meetingAction.deleteMany({ where: { responsibleId: { in: employeeIdsToDelete } } });
      await prisma.projectMember.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.projectTask.deleteMany({ where: { assigneeId: { in: employeeIdsToDelete } } });
      await prisma.projectAttendance.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.employeePosition.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.employee.deleteMany({ where: { id: { in: employeeIdsToDelete } } });
    }

    // Finally delete users
    await prisma.user.deleteMany({ where: { id: { in: userIdsToDelete } } });
    console.log(`\n✅ Deleted ${usersToDelete.length} users and all related data`);
  }

  console.log('\n🎉 Cleanup complete!');
  console.log('Kept users:', keptUsers.map(u => u.username).join(', '));
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });