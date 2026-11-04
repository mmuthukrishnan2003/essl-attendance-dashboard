import io
from app.database import SessionLocal
from app.attendance_service import calculate_daily_attendance_for_date
from app.monthly_service import get_monthly_attendance_matrix, get_monthly_late_count_report, generate_monthly_late_excel_report
from datetime import date

db = SessionLocal()

print("--- 1. Testing Daily Attendance & Late Detection ---")
daily = calculate_daily_attendance_for_date(date(2026, 11, 4), db)
print(f"Total staff: {len(daily['records'])}")
print(f"Late count: {daily.get('late_count', 'MISSING')}")

achsha = next((r for r in daily['records'] if r['emp_code'] == '540' or r['name'] == 'Achsha'), None)
if achsha:
    print(f"Achsha (#540): First IN = {achsha.get('first_in_time')}, is_late = {achsha.get('is_late')}, late_mins = {achsha.get('late_mins')}, late_text = {achsha.get('late_text')}")
    assert achsha.get('is_late') is True, "Achsha must be marked is_late=True for 09:07:11!"
else:
    print("Achsha not found in 2026-11-04 records")

print("\n--- 2. Testing Monthly Late Count Report ---")
late_data = get_monthly_late_count_report(2026, 11, db)
print(f"Total Active Staff: {late_data['total_active_staff']}")
print(f"Total Late Staff: {late_data['total_late_staff']}")
print(f"Total Late Punches: {late_data['total_late_punches']}")
print(f"Total Late Time: {late_data['total_late_hours_text']}")
print(f"Punctuality %: {late_data['overall_punctuality']}%")
print(f"Late Summary count: {len(late_data['summary'])}")
print(f"Late Incidents count: {len(late_data['incidents'])}")

if late_data['summary']:
    top_late = late_data['summary'][0]
    print(f"Top late employee: {top_late['name']} (#{top_late['emp_code']}) - Late Punches: {top_late['late_punch_count']}, Late Time: {top_late['total_late_text']}")

print("\n--- 3. Testing Monthly Late Excel Export ---")
excel_buf = generate_monthly_late_excel_report(2026, 11, db)
excel_bytes = excel_buf.getvalue()
print(f"Generated Excel size: {len(excel_bytes)} bytes")
assert len(excel_bytes) > 2000, "Excel export generated invalid bytes"

print("\n--- 4. Testing Monthly Muster Matrix Late Count Column ---")
matrix = get_monthly_attendance_matrix(2026, 11, db)
print(f"Matrix records: {len(matrix['records'])}")
matrix_late_total = sum(r.get('late_count', 0) for r in matrix['records'])
print(f"Sum of late counts in matrix: {matrix_late_total}")
assert matrix_late_total == late_data['total_late_punches'], f"Mismatch in late totals: {matrix_late_total} vs {late_data['total_late_punches']}"

print("\nALL BACKEND TESTS PASSED SUCCESSFULLY!")
db.close()

