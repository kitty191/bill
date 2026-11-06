# Room 2.6.1 constructs WorkManager's generated database with reflection.
# Preserve the no-argument constructor in optimized Release builds as well.
-keep class androidx.work.impl.WorkDatabase_Impl {
    public <init>();
}
