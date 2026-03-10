import React, { useEffect, useState } from 'react'
import {
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    useColorScheme,
    View,
} from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'

import { runSmokeCases, type SmokeCaseResult } from './src/smokeCases'

type Palette = {
    background: string
    card: string
    border: string
    text: string
    muted: string
    accent: string
    accentText: string
    successBg: string
    successText: string
    errorBg: string
    errorText: string
    codeBg: string
}

const lightPalette: Palette = {
    background: '#f4efe7',
    card: '#fffaf3',
    border: '#d6c7b3',
    text: '#1b1b18',
    muted: '#655c52',
    accent: '#b35c2e',
    accentText: '#fff8f3',
    successBg: '#dff2df',
    successText: '#235b2a',
    errorBg: '#f8d7d0',
    errorText: '#8d2b2b',
    codeBg: '#efe4d5',
}

const darkPalette: Palette = {
    background: '#181513',
    card: '#24201d',
    border: '#4b3f34',
    text: '#f5efe6',
    muted: '#c4b7a6',
    accent: '#d98a5f',
    accentText: '#1d130d',
    successBg: '#204227',
    successText: '#bde4c0',
    errorBg: '#572622',
    errorText: '#f3c0b8',
    codeBg: '#312923',
}

function App(): React.JSX.Element {
    const isDarkMode = useColorScheme() === 'dark'
    const palette = isDarkMode ? darkPalette : lightPalette
    const [results, setResults] = useState<SmokeCaseResult[]>([])

    useEffect(() => {
        setResults(runSmokeCases())
    }, [])

    const passedCount = results.filter((result) => result.pass).length
    const failedCount = results.length - passedCount

    return (
        <SafeAreaProvider>
            <SafeAreaView
                style={[styles.safeArea, { backgroundColor: palette.background }]}
                testID="verification-screen">
                <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
                <ScrollView contentContainerStyle={styles.content} testID="verification-scroll">
                    <View
                        style={[styles.heroCard, { backgroundColor: palette.card, borderColor: palette.border }]}
                        testID="verification-summary">
                        <Text style={[styles.eyebrow, { color: palette.muted }]} testID="verification-eyebrow">
                            Nitro Native Verification
                        </Text>
                        <Text style={[styles.title, { color: palette.text }]} testID="verification-title">
                            react-native-nitro-buffer example
                        </Text>
                        <Text style={[styles.subtitle, { color: palette.muted }]}>
                            Runs real Buffer operations inside a React Native app so you can inspect native parity without Jest mocks.
                        </Text>

                        <View style={styles.summaryRow}>
                            <View
                                style={[styles.summaryPill, { backgroundColor: palette.successBg }]}
                                testID="summary-pass-pill">
                                <Text style={[styles.summaryLabel, { color: palette.successText }]} testID="summary-pass-text">
                                    PASS {passedCount}
                                </Text>
                            </View>
                            <View
                                style={[styles.summaryPill, { backgroundColor: palette.errorBg }]}
                                testID="summary-fail-pill">
                                <Text style={[styles.summaryLabel, { color: palette.errorText }]} testID="summary-fail-text">
                                    FAIL {failedCount}
                                </Text>
                            </View>
                            <Pressable
                                accessibilityRole="button"
                                onPress={() => setResults(runSmokeCases())}
                                style={[styles.refreshButton, { backgroundColor: palette.accent }]}
                                testID="refresh-button">
                                <Text style={[styles.refreshLabel, { color: palette.accentText }]}>Run Again</Text>
                            </Pressable>
                        </View>
                    </View>

                    {results.map((result) => (
                        <View
                            key={result.id}
                            style={[styles.caseCard, { backgroundColor: palette.card, borderColor: palette.border }]}
                            testID={`case-${result.id}`}>
                            <View style={styles.caseHeader}>
                                <Text
                                    testID={`case-${result.id}-status`}
                                    style={[
                                        styles.caseStatus,
                                        {
                                            backgroundColor: result.pass ? palette.successBg : palette.errorBg,
                                            color: result.pass ? palette.successText : palette.errorText,
                                        },
                                    ]}>
                                    {result.pass ? 'PASS' : 'FAIL'}
                                </Text>
                                <Text style={[styles.caseId, { color: palette.text }]} testID={`case-${result.id}-id`}>
                                    {result.id}
                                </Text>
                            </View>

                            <Text
                                style={[styles.caseDescription, { color: palette.muted }]}
                                testID={`case-${result.id}-description`}>
                                {result.description}
                            </Text>

                            <Text style={[styles.caseLabel, { color: palette.text }]}>Expected</Text>
                            <Text
                                style={[styles.caseValue, { backgroundColor: palette.codeBg, color: palette.text }]}
                                testID={`case-${result.id}-expected`}>
                                {result.expected}
                            </Text>

                            <Text style={[styles.caseLabel, { color: palette.text }]}>Actual</Text>
                            <Text
                                style={[styles.caseValue, { backgroundColor: palette.codeBg, color: palette.text }]}
                                testID={`case-${result.id}-actual`}>
                                {result.actual}
                            </Text>

                            {result.error != null ? (
                                <>
                                    <Text style={[styles.caseLabel, { color: palette.text }]}>Error</Text>
                                    <Text
                                        style={[
                                            styles.caseValue,
                                            { backgroundColor: palette.codeBg, color: palette.errorText },
                                        ]}
                                        testID={`case-${result.id}-error`}>
                                        {result.error}
                                    </Text>
                                </>
                            ) : null}
                        </View>
                    ))}
                </ScrollView>
            </SafeAreaView>
        </SafeAreaProvider>
    )
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    content: {
        gap: 16,
        padding: 20,
        paddingBottom: 32,
    },
    heroCard: {
        borderRadius: 24,
        borderWidth: 1,
        gap: 12,
        padding: 20,
    },
    eyebrow: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1.4,
        textTransform: 'uppercase',
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        lineHeight: 34,
    },
    subtitle: {
        fontSize: 15,
        lineHeight: 22,
    },
    summaryRow: {
        alignItems: 'center',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 8,
    },
    summaryPill: {
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    summaryLabel: {
        fontSize: 13,
        fontWeight: '700',
    },
    refreshButton: {
        borderRadius: 999,
        marginLeft: 'auto',
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    refreshLabel: {
        fontSize: 13,
        fontWeight: '700',
    },
    caseCard: {
        borderRadius: 20,
        borderWidth: 1,
        gap: 8,
        padding: 18,
    },
    caseHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 10,
    },
    caseStatus: {
        borderRadius: 999,
        fontSize: 12,
        fontWeight: '800',
        overflow: 'hidden',
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    caseId: {
        flexShrink: 1,
        fontSize: 17,
        fontWeight: '700',
    },
    caseDescription: {
        fontSize: 14,
        lineHeight: 20,
    },
    caseLabel: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.6,
        marginTop: 4,
        textTransform: 'uppercase',
    },
    caseValue: {
        borderRadius: 12,
        fontSize: 13,
        lineHeight: 19,
        overflow: 'hidden',
        padding: 12,
    },
})

export default App
