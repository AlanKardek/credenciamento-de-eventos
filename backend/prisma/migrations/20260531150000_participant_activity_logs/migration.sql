-- CreateTable
CREATE TABLE "ParticipantActivityLog" (
    "id" SERIAL NOT NULL,
    "participantId" INTEGER NOT NULL,
    "actorUserId" INTEGER,
    "action" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParticipantActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParticipantActivityLog_participantId_createdAt_idx" ON "ParticipantActivityLog"("participantId", "createdAt");

-- CreateIndex
CREATE INDEX "ParticipantActivityLog_actorUserId_idx" ON "ParticipantActivityLog"("actorUserId");

-- AddForeignKey
ALTER TABLE "ParticipantActivityLog" ADD CONSTRAINT "ParticipantActivityLog_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantActivityLog" ADD CONSTRAINT "ParticipantActivityLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
