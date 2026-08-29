from northstar.compiler.options import occ_expiry_yymmdd, occ_is_put, occ_strike


def test_occ_parsing():
    sym = "AMD260918P00170000"
    assert occ_is_put(sym)
    assert occ_strike(sym) == 170.0
    assert occ_expiry_yymmdd(sym) == "260918"

    sym2 = "GOOGL261016C00250500"
    assert not occ_is_put(sym2)
    assert occ_strike(sym2) == 250.5
    assert occ_expiry_yymmdd(sym2) == "261016"
