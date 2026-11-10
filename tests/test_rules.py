"""The title rule and the Dallas-area location rule."""

import pytest

from watcher.rules import in_dallas, in_role, is_remote


@pytest.mark.parametrize("title", [
    "Credit Analyst",
    "Credit Analyst II",
    "Commercial Credit Analyst - Energy",
    "Senior Credit Risk Analyst",
    "Credit Portfolio Officer",
    "Central Credit Underwriter II - Commercial",
    "Commercial Lending Underwriter - Vice President",
    "Analyst, Dealer Commercial Services Underwriting",
    "Loan Review Analyst",
    "Associate, Credit Risk Management",
])
def test_in_role(title):
    assert in_role(title)


@pytest.mark.parametrize("title", [
    "Credit Analyst Intern",
    "2027 Summer Analyst - Credit",
    "Associate Customer Service Representative - Credit Cards - Bilingual",
    "Credit Card Sales Specialist",
    "Collections Specialist - Credit Card",
    "Software Engineer, Credit Platform",
    "Managing Director, Credit Risk",
    "Teller",
    "Financial Analyst",
    "Insurance Underwriter",
    "Global Credit Trading - Credit Exotics Trader - Analyst",
    "Quantitative Research - Wholesale Credit Risk - Associate",
    "Client Reporting Senior Analyst- Global Credit Operations",
    "Credit Risk Model Operations Analyst",
    "",
])
def test_not_in_role(title):
    assert not in_role(title)


@pytest.mark.parametrize("loc", [
    "Dallas, TX", "Plano-TX", "Irving, Texas", "TX - Frisco", "Las Colinas, TX",
    "Fort Worth, TX (+2 more)", "Arlington, TX", "Westlake, Texas, United States",
])
def test_in_dallas(loc):
    assert in_dallas(loc)


@pytest.mark.parametrize("loc", [
    "Houston, TX", "Dallas, GA", "Westlake, OH", "Arlington, VA", "New York, NY", "Remote", "",
])
def test_not_in_dallas(loc):
    assert not in_dallas(loc)


@pytest.mark.parametrize("title,loc", [
    ("Credit Analyst", "Remote, United States"),
    ("Credit Analyst", "Dallas, TX (Remote)"),
    ("Credit Analyst", "Virtual"),
    ("Credit Analyst - Remote", "Dallas, TX"),
    ("Credit Analyst", "REMOTE/TELETRAVAIL, ON, CAN"),
])
def test_remote(title, loc):
    assert is_remote(title, loc)


@pytest.mark.parametrize("title,loc", [
    ("Credit Analyst", "Dallas, TX"),
    ("Credit Analyst", "Plano TX (+2 more)"),
    ("Virtual Banking Credit Analyst", "Irving, TX"),
])
def test_not_remote(title, loc):
    assert not is_remote(title, loc)


def test_remote_location_is_not_dallas():
    assert not in_dallas("Dallas, TX (Remote)")
